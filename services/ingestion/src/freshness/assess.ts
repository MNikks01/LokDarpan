import { collectionStatusOf, type CollectionWindow } from "@lokdarpan/database";

/**
 * Whether collection is healthy, from what the ledger records about it.
 *
 * WHY THIS EXISTS
 * On 29 September 2026 the database refused connections for a day and nobody
 * was told: the sweep failed, the site showed errors, and the only signal was a
 * person happening to look. A scheduled job that fails emails whoever last
 * edited its schedule, at best; a job that never starts tells nobody anything.
 * This reads the ledger's own record of collection and says what is wrong.
 *
 * THREE QUESTIONS, EACH A DIFFERENT FAILURE
 * - Is any portal `stale` or `failing`? The same rule the site shows readers
 *   (`collectionStatusOf`), so the alert and the page cannot disagree.
 * - Did a sweep start at all recently? A schedule that stops firing leaves no
 *   run behind, and would otherwise surface only after 48 hours, as stale.
 * - Is a run stuck in `running`? The collector died without closing it.
 */

/** A daily sweep plus slack for GitHub's queue. */
export const SWEEP_EXPECTED_WITHIN_HOURS = 26;

/** Longer than the sweep's own 45-minute timeout, with room to spare. */
export const STUCK_AFTER_HOURS = 2;

export interface CollectionFacts {
  readonly windows: readonly CollectionWindow[];
  readonly lastSweepStartedAt: Date | null;
  readonly stuck: readonly { readonly sourceId: string; readonly startedAt: Date }[];
}

export interface Assessment {
  readonly healthy: boolean;
  readonly problems: readonly string[];
  /** Markdown, suitable as the body of an issue. */
  readonly report: string;
}

const HOUR = 3_600_000;

function when(value: string | Date | null): string {
  if (value === null) return "never";
  return new Date(value).toISOString().replace(".000Z", "Z");
}

export function assessCollection(facts: CollectionFacts, now: Date): Assessment {
  const problems: string[] = [];

  const rows = facts.windows.map((w) => ({ window: w, status: collectionStatusOf(w, now) }));
  for (const { window, status } of rows) {
    if (status === "failing") {
      problems.push(
        `Portal \`${window.portalCode}\` is failing: last tried ${when(window.lastCheckedAt)}, ` +
          `last succeeded ${when(window.lastSuccessAt)}.`,
      );
    } else if (status === "stale") {
      problems.push(
        `Portal \`${window.portalCode}\` is stale: no success since ${when(window.lastSuccessAt)}.`,
      );
    }
  }

  const sweepDue = now.getTime() - SWEEP_EXPECTED_WITHIN_HOURS * HOUR;
  if (facts.lastSweepStartedAt === null || facts.lastSweepStartedAt.getTime() < sweepDue) {
    problems.push(
      `No tender sweep has started in ${String(SWEEP_EXPECTED_WITHIN_HOURS)} hours ` +
        `(last: ${when(facts.lastSweepStartedAt)}). The schedule may not be firing.`,
    );
  }

  for (const run of facts.stuck) {
    problems.push(
      `Run \`${run.sourceId}\` has been \`running\` since ${when(run.startedAt)}: ` +
        `the collector probably died without closing it.`,
    );
  }

  const table = [
    "| Portal | Status | Last success | Last tried |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      ({ window, status }) =>
        `| ${window.portalCode} | ${status} | ${when(window.lastSuccessAt)} | ${when(window.lastCheckedAt)} |`,
    ),
  ].join("\n");

  const headline = problems.length === 0 ? "healthy" : `${String(problems.length)} problem(s)`;
  const report = [
    `**Collection check at ${when(now)}: ${headline}.**`,
    "",
    ...(problems.length === 0 ? [] : [...problems.map((p) => `- ${p}`), ""]),
    table,
    "",
    "Recovery: `.docs/16-operations/collection-schedule.md` §Recovery.",
  ].join("\n");

  return { healthy: problems.length === 0, problems, report };
}
