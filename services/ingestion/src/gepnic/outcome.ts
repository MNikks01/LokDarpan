/**
 * What a sweep's portal outcomes mean for the process's exit code.
 *
 * Kept apart from the CLI so the decision can be tested directly. The CLI is a
 * process entrypoint — importing it runs it — and this is the part worth
 * asserting.
 */

export interface PortalOutcome {
  readonly portal: string;
  readonly advertised: number;
  readonly inserted: number;
  /** Existing tenders seen again, whether or not anything about them differed. */
  readonly updated: number;
  /** Of those, how many the portal actually changed. */
  readonly changed: number;
  readonly placed: number;
  readonly failed: number;
  /** Set when the portal could not be collected at all. */
  readonly refusal: string | null;
}

/** Every attempted portal refused or failed. Nothing was collected. */
export const EXIT_ALL_REFUSED = 69;

/**
 * The exit code a finished sweep should leave.
 *
 * THE BUG THIS FIXES
 * A sweep exited 0 whatever happened. Refusals were counted and named in the
 * summary and never reached the exit code, so a day on which every portal
 * refused looked to a scheduler exactly like a day on which everything worked.
 *
 * PARTIAL FAILURE STAYS A SUCCESS, DELIBERATELY
 * Some portals refusing while others collect is a gap in coverage, not a failed
 * run: the records that did arrive are real, the ones that did not are named in
 * the summary, and `tender_collection_window` records the outcome per portal. A
 * scheduler that went red for one refusing portal out of twenty would go red
 * most days and stop being read.
 *
 * A sweep with no targets at all is not a failure either — there was nothing to
 * refuse. That is a usage question, and the CLI answers it before reaching here.
 */
export function sweepExitCode(outcomes: readonly PortalOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const refused = outcomes.filter((o) => o.refusal !== null);
  return refused.length === outcomes.length ? EXIT_ALL_REFUSED : 0;
}
