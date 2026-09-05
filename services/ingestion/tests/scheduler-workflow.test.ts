import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

/**
 * The scheduler's configuration, read as configuration rather than as text.
 *
 * A workflow is only exercised when it runs, and a scheduled one runs once a
 * day — so a typo costs a day of collection and is discovered by noticing
 * missing data. These assertions are the parts that cannot be checked any other
 * way without waiting.
 */

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly env?: Record<string, string>;
}

interface Workflow {
  readonly on: {
    readonly schedule?: readonly { readonly cron: string }[];
    readonly workflow_dispatch?: unknown;
  };
  readonly permissions: Record<string, string>;
  readonly concurrency: { readonly group: string; readonly "cancel-in-progress": boolean };
  readonly jobs: Record<
    string,
    { readonly steps: readonly Step[]; readonly "timeout-minutes"?: number }
  >;
}

const read = (name: string): string =>
  readFileSync(join(process.cwd(), ".github", "workflows", name), "utf8");

describe("the tender ingestion workflow", () => {
  const scheduled = load(read("ingest-tenders.yml")) as Workflow;

  it("is valid YAML with the job it claims", () => {
    expect(Object.keys(scheduled.jobs)).toEqual(["gepnic"]);
  });

  it("runs once a day", () => {
    expect(scheduled.on.schedule).toEqual([{ cron: "0 20 * * *" }]);
  });

  it("can be triggered by hand", () => {
    // Recovery after a failed run, and the only way to test the schedule
    // without waiting for it.
    expect("workflow_dispatch" in scheduled.on).toBe(true);
  });

  it("invokes the existing ingestion command and does not reimplement it", () => {
    const collect = (scheduled.jobs["gepnic"]?.steps ?? []).find((s) => s.name === "Collect");
    expect(collect?.run).toBe("pnpm --filter @lokdarpan/ingestion ingest:gepnic --all");
    // `--all` matters: without it the CLI wants a single --portal and exits 64.
    expect(collect?.run).toContain("--all");
  });

  it("gives the credential to that step and no other", () => {
    const withEnv = (scheduled.jobs["gepnic"]?.steps ?? []).filter((s) => s.env !== undefined);
    expect(withEnv).toHaveLength(1);
    expect(withEnv[0]?.env?.["DATABASE_URL"]).toBe("${{ secrets.INGEST_DATABASE_URL }}");
  });

  it("never writes the credential into a command", () => {
    for (const step of scheduled.jobs["gepnic"]?.steps ?? []) {
      // A secret on a command line reaches the process table and, on failure,
      // often the log.
      expect(step.run ?? "").not.toContain("secrets.");
      expect(step.run ?? "").not.toContain("postgresql://");
    }
  });

  it("asks for no more of the GitHub token than reading the repository", () => {
    expect(scheduled.permissions).toEqual({ contents: "read" });
  });

  it("guards against overlapping runs at the scheduler level", () => {
    expect(scheduled.concurrency.group).toBe("ingest-gepnic");
    // Cancelling would kill a sweep that is working. The database advisory lock
    // is what actually prevents two sweeps colliding.
    expect(scheduled.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("cannot hang forever holding the sweep lock", () => {
    expect(scheduled.jobs["gepnic"]?.["timeout-minutes"]).toBeGreaterThan(0);
  });

  it("uses the same toolchain versions as CI", () => {
    // A scheduler that installs a different pnpm is a second environment to keep
    // working, discovered on the day it breaks.
    const ci = read("ci.yml");
    const text = read("ingest-tenders.yml");
    for (const key of ["NODE_VERSION", "PNPM_VERSION"]) {
      const from = (source: string): string | undefined =>
        new RegExp(`${key}:\\s*"([^"]+)"`, "u").exec(source)?.[1];
      expect(from(text)).toBe(from(ci));
    }
  });
});
