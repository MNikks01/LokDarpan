import { describe, expect, it } from "vitest";

import { EXIT_ALL_REFUSED, sweepExitCode, type PortalOutcome } from "../src/gepnic/outcome";

const collected = (portal: string): PortalOutcome => ({
  portal,
  advertised: 20,
  inserted: 3,
  updated: 17,
  changed: 2,
  placed: 12,
  failed: 0,
  refusal: null,
});

const refused = (portal: string, why = "robots.txt disallows crawling"): PortalOutcome => ({
  portal,
  advertised: 0,
  inserted: 0,
  updated: 0,
  changed: 0,
  placed: 0,
  failed: 0,
  refusal: why,
});

/**
 * A sweep exited 0 whatever happened. Refusals were counted and named in the
 * summary and never reached the exit code, so a day on which every portal
 * refused looked to a scheduler exactly like a day on which everything worked —
 * and the scheduler would have recorded it green.
 */
describe("what a finished sweep's outcomes mean for the exit code", () => {
  it("succeeds when every portal was collected", () => {
    expect(sweepExitCode([collected("kerala"), collected("odisha")])).toBe(0);
  });

  // The regression. Twenty portals, nothing collected, and the process used to
  // say it went fine.
  it("fails when every attempted portal refused", () => {
    expect(sweepExitCode([refused("kerala"), refused("odisha"), refused("punjab")])).toBe(
      EXIT_ALL_REFUSED,
    );
  });

  it("fails when the only portal attempted refused", () => {
    expect(sweepExitCode([refused("kerala")])).toBe(EXIT_ALL_REFUSED);
  });

  // Deliberately still a success: the records that arrived are real, the ones
  // that did not are named, and a scheduler that went red for one refusing
  // portal in twenty would go red most days and stop being read.
  it("succeeds when some portals refused and others collected", () => {
    expect(sweepExitCode([collected("kerala"), refused("odisha")])).toBe(0);
  });

  it("succeeds when a portal collected nothing but did not refuse", () => {
    const empty: PortalOutcome = { ...collected("goa"), advertised: 0, inserted: 0, placed: 0 };
    // Collected and found nothing is not a refusal, and must not read as one.
    expect(sweepExitCode([empty, collected("kerala")])).toBe(0);
  });

  it("succeeds when every portal collected nothing without refusing", () => {
    const empty: PortalOutcome = { ...collected("goa"), advertised: 0, inserted: 0, placed: 0 };
    expect(sweepExitCode([empty])).toBe(0);
  });

  // Nothing was attempted, so nothing refused. Usage errors are the CLI's to
  // report, and it does so before reaching here.
  it("succeeds when there were no targets at all", () => {
    expect(sweepExitCode([])).toBe(0);
  });
});
