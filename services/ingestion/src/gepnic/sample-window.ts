import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CrawlNotPermitted, PortalSession } from "./fetch";
import { parseLanding } from "./landing";
import { PORTALS } from "./portals";

/**
 * Record what is on each portal's landing page, once.
 *
 *   ingest:gepnic-sample --out=/path/to/window-samples.jsonl
 *
 * WHY THIS EXISTS
 * `tender-collection-cadence.md` measured the landing window turning over
 * almost completely within six hours, from two samples. Two points do not give
 * a decay curve, and the cadence question — how often collection must run to
 * avoid systematically misrepresenting what governments advertise — deserves
 * better than an interpolation between them.
 *
 * WHY IT DOES NOT USE THE INGEST
 * Answering "which tenders are listed right now" needs the landing page and
 * nothing else. The ingest additionally fetches a detail page per tender, so
 * running it hourly for a day would be roughly ten thousand requests to
 * government servers where about a thousand answers the question. Twenty times
 * the load for the same measurement is not a trade worth making against public
 * infrastructure.
 *
 * WHY IT WRITES NO DATABASE ROWS
 * This is instrumentation, not collection. Its output measures our own
 * coverage, not what a government published, and mixing it into the ledger
 * would put experimental data behind the same provenance the ledger promises
 * for official records.
 */

interface Observation {
  /** When we looked. Not a publication date. */
  readonly at: string;
  readonly portal: string;
  readonly sp: string;
  readonly title: string;
  readonly closingAt: string | null;
  readonly reference: string;
}

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

/** Courtesy gap between portals. One page each, so this is the whole cost. */
const PAUSE_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sampleOne(portal: (typeof PORTALS)[number], at: string): Promise<string[]> {
  try {
    const { landing } = await PortalSession.open(portal.baseUrl);
    const { tenders } = parseLanding(landing.body);
    return tenders.map((tender) =>
      JSON.stringify({
        at,
        portal: portal.code,
        sp: tender.portalTenderId,
        title: tender.title,
        closingAt: tender.closingAt,
        reference: tender.tenderReference,
      } satisfies Observation),
    );
  } catch (error: unknown) {
    // A portal that refuses or falls over costs only itself, and the gap is
    // recorded rather than left to look like an empty page — a missing sample
    // and an empty one mean different things to the curve.
    const why =
      error instanceof CrawlNotPermitted
        ? "disallows crawling"
        : error instanceof Error
          ? error.message.slice(0, 60)
          : "unreachable";
    return [JSON.stringify({ at, portal: portal.code, unreachable: why })];
  }
}

/**
 * How many passes are already in the file.
 *
 * Counted from the distinct timestamps rather than tracked in a state file,
 * so the limit cannot drift away from the data it is limiting.
 */
async function passesSoFar(out: string): Promise<number> {
  try {
    const body = await readFile(out, "utf8");
    const stamps = new Set<string>();
    for (const line of body.split("\n")) {
      if (line === "") continue;
      const at = (JSON.parse(line) as { at?: string }).at;
      if (at !== undefined) stamps.add(at);
    }
    return stamps.size;
  } catch {
    // No file yet, or an unreadable one. Either way, nothing has been sampled.
    return 0;
  }
}

async function main(): Promise<void> {
  const out = arg("out");
  if (out === undefined) {
    process.stderr.write("Usage: ingest:gepnic-sample --out=<path> [--max-passes=N]\n");
    process.exit(64);
  }
  await mkdir(dirname(out), { recursive: true });

  // AN EXPERIMENT THAT DOES NOT STOP ITSELF BECOMES PERMANENT LOAD.
  //
  // This is scheduled hourly to measure a decay curve over one day. Relying on
  // someone remembering to remove the cron entry tomorrow is how a temporary
  // measurement turns into a year of unattended requests against public
  // servers. It stops on its own instead.
  const maxPasses = Number(arg("max-passes") ?? "24");
  const done = await passesSoFar(out);
  if (Number.isInteger(maxPasses) && done >= maxPasses) {
    process.stdout.write(`${String(done)} passes already recorded; sampling is complete.\n`);
    return;
  }

  // One timestamp for the whole pass, so every portal in a sample shares a
  // bucket. The pass takes about a minute; treating each portal's own clock
  // reading as distinct would scatter one observation across two hours.
  const at = new Date().toISOString();
  const lines: string[] = [];
  for (const [index, portal] of PORTALS.entries()) {
    if (index > 0) await sleep(PAUSE_MS);
    lines.push(...(await sampleOne(portal, at)));
  }

  await appendFile(out, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`${at}  ${String(lines.length)} observations\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
