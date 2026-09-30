import "server-only";

import type { LedgerOverview } from "@lokdarpan/database/overview";
import { inLedger } from "@/server/container";

/**
 * The homepage's numbers, or a plain statement that they could not be read.
 *
 * The homepage is the one screen that must render when the ledger does not —
 * as it did not on 29 September 2026, when the database's transfer quota ran
 * out. So a failure here is not an error page: it is `unavailable`, and the
 * page says so in place of every number, never a zero and never a figure
 * remembered from an earlier build.
 */
export type HomeSummary =
  | {
      readonly status: "held";
      readonly overview: LedgerOverview;
      readonly datasetVersion: number;
      /** When the dataset version the numbers belong to was opened, ISO 8601. */
      readonly asOf: string | null;
    }
  | { readonly status: "unavailable" };

/**
 * How long the homepage waits for the ledger. The pool sets no connect timeout,
 * and a host that drops packets holds a connection open for over a minute —
 * long enough to fail a build's static generation. Past this, the page renders
 * its unavailable state instead.
 */
const WAIT_MS = 8_000;

export async function loadHomeSummary(): Promise<HomeSummary> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`no answer from the ledger in ${String(WAIT_MS)} ms`));
      }, WAIT_MS);
    });
    const { data, datasetVersion, asOf } = await Promise.race([
      inLedger((ledger) => ledger.overview.overview()),
      timeout,
    ]);
    return { status: "held", overview: data, datasetVersion, asOf };
  } catch (error: unknown) {
    process.stdout.write(
      `${JSON.stringify({
        level: "error",
        message: "ledger_unavailable",
        detail: error instanceof Error ? error.message : "unknown",
        service: "web",
        route: "/",
        time: new Date().toISOString(),
      })}\n`,
    );
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
