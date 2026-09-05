import pg from "pg";

import { parseDetail } from "./detail";
import { CrawlNotPermitted, PortalSession, isStaleSession } from "./fetch";
import { parseLanding } from "./landing";
import { districtsOfState, loadTenders, type TenderRecord } from "./load";
import { GEPNIC_SWEEP_LOCK, sweepLockHolder, takeSweepLock } from "../advisory-lock";
import { openRun } from "../ingestion-run";
import { EXIT_ALL_REFUSED, sweepExitCode, type PortalOutcome } from "./outcome";
import { PORTALS, portalByCode } from "./portals";

/**
 * Collect one GePNIC portal's currently advertised tenders.
 *
 *   ingest:gepnic --portal=tn --base=https://tntenders.gov.in --state=33
 *
 * One portal per run, with a pause between detail pages. A state portal is
 * public infrastructure serving citizens; a connector that hammers it is a
 * connector that deserves to be blocked.
 *
 * FORWARD-ONLY, AND THAT IS NOT A DEFECT
 * The landing page shows a rolling window of about twenty current tenders and
 * cannot be paged backwards. Running daily accumulates the tender universe from
 * the day collection starts and can never recover what was advertised before
 * that. `tender_collection_window` records the floor, so the site can state it
 * rather than let a gap read as a silence.
 */

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

const EXIT_MISCONFIGURED = 78;
const EXIT_USAGE = 64;
const EXIT_NOT_PERMITTED = 77;
/**
 * Another sweep is already running, so this one did nothing.
 *
 * `EX_TEMPFAIL`: not a fault, and not a success either. The next scheduled run
 * will find the lock free.
 */
const EXIT_ALREADY_RUNNING = 75;

/** Courtesy gap between detail fetches. */
const PAUSE_MS = 1_500;

/**
 * Longer gap between portals in a sweep.
 *
 * Each is a different government's server, and finishing one is a natural
 * place to pause rather than rolling straight into the next.
 */
const BETWEEN_PORTALS_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detailUrl(baseUrl: string, portalTenderId: string): string {
  return `${baseUrl}/nicgep/app?component=%24DirectLink&page=Home&service=direct&session=T&sp=${portalTenderId}`;
}

async function collectDetails(
  session: PortalSession,
  baseUrl: string,
  tenders: readonly TenderRecord["listed"][],
  known: ReadonlySet<string>,
): Promise<TenderRecord[]> {
  const records: TenderRecord[] = [];
  for (const listed of tenders) {
    await sleep(PAUSE_MS);
    let detail: TenderRecord["detail"] = null;
    try {
      const page = await session.get(detailUrl(baseUrl, listed.portalTenderId));
      // A lapsed session answers 200 with a notice. Parsed as data it would say
      // this office advertised nothing, which is false.
      detail = isStaleSession(page.body) ? null : parseDetail(page.body, known);
    } catch {
      // One unreachable detail page must not cost us the tender. It is held
      // from the landing row, unplaced, and picked up on a later run.
      detail = null;
    }
    records.push({ listed, detail });
  }
  return records;
}

interface Target {
  readonly portalCode: string;
  readonly baseUrl: string;
  readonly stateLgdCode: string;
}

/**
 * Which portal to collect from.
 *
 * `--base` and `--state` stay available so a deployment can be tried before it
 * is added to the table, but the table is the normal path: its URLs come from
 * the verified source registry rather than from whoever is typing the command.
 */
function resolveTarget(): Target {
  const portalCode = arg("portal");
  const portal = portalCode === undefined ? undefined : portalByCode(portalCode);
  const baseUrl = arg("base") ?? portal?.baseUrl;
  const stateLgdCode = arg("state") ?? portal?.stateLgdCode;

  if (portalCode === undefined || baseUrl === undefined || stateLgdCode === undefined) {
    process.stderr.write(
      "Usage: ingest:gepnic --portal=<code> [--base=<https://host> --state=<lgd code>]\n\n" +
        `Known portals (${String(PORTALS.length)}):\n` +
        PORTALS.map((p) => `  ${p.code.padEnd(14)} ${p.state}\n`).join(""),
    );
    process.exit(EXIT_USAGE);
  }
  return { portalCode, baseUrl, stateLgdCode };
}

/**
 * Collect one portal.
 *
 * Returns an outcome rather than printing and exiting, so a sweep can carry on
 * past a portal that refuses us or falls over. A single run still surfaces
 * everything through the summary printed by the caller.
 */
async function collectPortal(client: pg.Client, target: Target): Promise<PortalOutcome> {
  const { portalCode, baseUrl, stateLgdCode } = target;
  const empty = {
    portal: portalCode,
    advertised: 0,
    inserted: 0,
    updated: 0,
    changed: 0,
    placed: 0,
    failed: 0,
  };

  let session;
  let landing;
  try {
    ({ session, landing } = await PortalSession.open(baseUrl));
  } catch (error: unknown) {
    // A portal that disallows crawling is a finding, not a failure — and it
    // must not stop the twenty that permit it.
    const refusal =
      error instanceof CrawlNotPermitted
        ? "disallows crawling"
        : error instanceof Error
          ? error.message.slice(0, 70)
          : "unreachable";
    return { ...empty, refusal };
  }

  const { tenders } = parseLanding(landing.body);
  if (tenders.length === 0) return { ...empty, refusal: null };

  const districts = await districtsOfState(client, stateLgdCode);
  if (districts.size === 0) {
    // Without the state's districts every tender loads unplaced and the map
    // shows an empty country while the run reports success.
    return { ...empty, advertised: tenders.length, refusal: "no districts held for this state" };
  }

  const records = await collectDetails(session, baseUrl, tenders, new Set(districts.keys()));
  const result = await loadTenders(client, {
    portalCode,
    stateLgdCode,
    records,
    artifact: landing,
    datasetDescription: `gepnic ${portalCode} landing ${landing.retrievedAt}`,
  });

  return {
    portal: portalCode,
    advertised: tenders.length,
    inserted: result.inserted,
    updated: result.updated,
    changed: result.changed,
    placed: result.placed,
    failed: result.failed.length,
    refusal: null,
  };
}

function line(outcome: PortalOutcome): string {
  if (outcome.refusal !== null) {
    return `  ${outcome.portal.padEnd(14)} ${outcome.refusal}\n`;
  }
  // `changed` is reported beside `new` because a run in which every tender was
  // seen and none had changed is a healthy run, and it otherwise looks identical
  // to a run that collected nothing.
  return (
    `  ${outcome.portal.padEnd(14)} ${String(outcome.advertised).padStart(3)} advertised · ` +
    `${String(outcome.inserted).padStart(3)} new · ` +
    `${String(outcome.changed).padStart(3)} changed · ` +
    `${String(outcome.placed).padStart(3)} placed\n`
  );
}

/**
 * Records a sweep that stopped because another held the lock.
 *
 * A skipped sweep touches no portal and so leaves no per-portal run behind.
 * Without this row a scheduled run that did nothing would be indistinguishable
 * from one that never fired — which is the confusion `ingestion_run` exists to
 * remove. `skipped` is its own status because the sweep neither failed nor
 * collected; see migration 0030.
 */
async function recordSkip(client: pg.Client): Promise<void> {
  const holder = await sweepLockHolder(client);
  const where = holder === null ? "" : ` (backend ${String(holder)})`;
  const runId = await openRun(client, "gepnic-sweep");
  await client.query(
    `UPDATE ingestion_run SET status = 'skipped', completed_at = now(), note = $2
      WHERE id = $1`,
    [runId, `another sweep holds advisory lock ${String(GEPNIC_SWEEP_LOCK)}${where}`],
  );
  process.stderr.write(`Another sweep is already running${where}. Nothing was collected.\n`);
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(EXIT_MISCONFIGURED);
  }

  const sweep = process.argv.includes("--all");
  const targets: readonly Target[] = sweep
    ? PORTALS.map((p) => ({
        portalCode: p.code,
        baseUrl: p.baseUrl,
        stateLgdCode: p.stateLgdCode,
      }))
    : [resolveTarget()];

  const client = new pg.Client({ connectionString });
  await client.connect();

  // Taken on this client and held for the whole sweep, so the server releases it
  // if the process dies. See `advisory-lock.ts`.
  const lock = await takeSweepLock(client);
  if (lock === null) {
    await recordSkip(client);
    await client.end();
    process.exit(EXIT_ALREADY_RUNNING);
  }

  const outcomes: PortalOutcome[] = [];
  try {
    for (const [index, target] of targets.entries()) {
      if (index > 0) await sleep(BETWEEN_PORTALS_MS);
      process.stdout.write(`${target.portalCode} …\n`);
      const outcome = await collectPortal(client, target);
      outcomes.push(outcome);
      process.stdout.write(line(outcome));
    }
  } finally {
    await lock.release();
    await client.end();
  }

  const total = outcomes.reduce(
    (sum, o) => ({
      advertised: sum.advertised + o.advertised,
      inserted: sum.inserted + o.inserted,
      placed: sum.placed + o.placed,
    }),
    { advertised: 0, inserted: 0, placed: 0 },
  );
  const refused = outcomes.filter((o) => o.refusal !== null);

  process.stdout.write(
    `\n${String(outcomes.length)} portal(s): ${String(total.advertised)} advertised, ` +
      `${String(total.inserted)} new, ${String(total.placed)} placed to a district\n`,
  );
  if (refused.length > 0) {
    // Named, never summed away. A portal we could not collect is a gap in the
    // map, and the operator has to know which one.
    process.stdout.write(`${String(refused.length)} not collected:\n`);
    for (const o of refused) process.stdout.write(line(o));
  }

  // A sweep in which every portal refused collected nothing, and the process
  // has to say so. Some refusing and some succeeding stays a success: that is a
  // gap in coverage, which the summary names and `tender_collection_window`
  // records per portal, not a failed run.
  if (sweepExitCode(outcomes) === EXIT_ALL_REFUSED) {
    process.stderr.write(
      `All ${String(outcomes.length)} portal(s) refused or failed. Nothing was collected.\n`,
    );
    process.exit(EXIT_ALL_REFUSED);
  }
}

main().catch((error: unknown) => {
  if (error instanceof CrawlNotPermitted) {
    // Not a failure. The publisher stated a policy and we are honouring it.
    process.stderr.write(`${error.message}\n`);
    process.exit(EXIT_NOT_PERMITTED);
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
