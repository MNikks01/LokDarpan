import pg from "pg";

import { parseDetail } from "./detail";
import { CrawlNotPermitted, PortalSession, isStaleSession } from "./fetch";
import { parseLanding } from "./landing";
import { districtsOfState, loadTenders, type TenderRecord } from "./load";

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

/** Courtesy gap between detail fetches. */
const PAUSE_MS = 1_500;

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

function report(records: readonly TenderRecord[]): void {
  const byDepartment = new Map<string, number>();
  for (const record of records) {
    const name = record.detail?.department ?? "(not stated)";
    byDepartment.set(name, (byDepartment.get(name) ?? 0) + 1);
  }
  process.stdout.write("\nBy department:\n");
  for (const [name, count] of [...byDepartment].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${String(count).padStart(3)}  ${name}\n`);
  }
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(EXIT_MISCONFIGURED);
  }
  const portalCode = arg("portal");
  const baseUrl = arg("base");
  const stateLgdCode = arg("state");
  if (portalCode === undefined || baseUrl === undefined || stateLgdCode === undefined) {
    process.stderr.write(
      "Usage: ingest:gepnic --portal=<code> --base=<https://host> --state=<lgd code>\n",
    );
    process.exit(EXIT_USAGE);
  }

  process.stdout.write(`Checking ${baseUrl} for a crawl policy …\n`);
  const { session, landing } = await PortalSession.open(baseUrl);
  const { tenders, rejected } = parseLanding(landing.body);
  process.stdout.write(
    `  ${String(tenders.length)} advertised tenders, ${String(rejected.length)} rejected\n`,
  );
  if (tenders.length === 0) {
    process.stdout.write("Nothing advertised on the landing page right now.\n");
    return;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const districts = await districtsOfState(client, stateLgdCode);
    if (districts.size === 0) {
      // Without the state's districts every tender loads unplaced and the map
      // shows an empty country while the run reports success.
      process.stderr.write(
        `No districts held for state ${stateLgdCode}. Ingest boundaries first.\n`,
      );
      process.exit(EXIT_MISCONFIGURED);
    }

    const records = await collectDetails(session, baseUrl, tenders, new Set(districts.keys()));
    const result = await loadTenders(client, {
      portalCode,
      stateLgdCode,
      records,
      artifact: landing,
      datasetDescription: `gepnic ${portalCode} landing ${landing.retrievedAt}`,
    });

    process.stdout.write(
      `\n${String(result.inserted)} inserted, ${String(result.updated)} updated, ` +
        `${String(result.failed.length)} failed\n` +
        `${String(result.placed)} of ${String(records.length)} placed to a district\n`,
    );
    for (const failure of result.failed.slice(0, 5)) {
      process.stdout.write(`  ! ${failure.portalTenderId}: ${failure.reason}\n`);
    }
    report(records);
  } finally {
    await client.end();
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
