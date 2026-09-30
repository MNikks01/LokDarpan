import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

/**
 * The alert's configuration, read as configuration.
 *
 * Like the sweep it watches, it only runs once a day, so a mistake here is found
 * by an alert that never comes. These are the properties that matter: it runs
 * after the sweep, the database credential reaches one step, and only the jobs
 * that open or close the issue may write — to issues, and nothing else.
 */

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly env?: Record<string, string>;
}

interface Job {
  readonly needs?: string;
  readonly if?: string;
  readonly permissions?: Record<string, string>;
  readonly steps: readonly Step[];
}

interface Workflow {
  readonly on: {
    readonly schedule?: readonly { readonly cron: string }[];
    readonly workflow_dispatch?: unknown;
  };
  readonly permissions: Record<string, string>;
  readonly env: Record<string, string>;
  readonly jobs: Record<string, Job>;
}

const workflow = load(
  readFileSync(join(process.cwd(), ".github", "workflows", "check-collection.yml"), "utf8"),
) as Workflow;

const SECRET = "${{ secrets.INGEST_DATABASE_URL }}";

describe("the collection-check workflow", () => {
  it("runs daily, after the 20:00 UTC sweep, and can be run by hand", () => {
    const cron = workflow.on.schedule?.[0]?.cron ?? "";
    const [minute, hour, ...rest] = cron.split(" ");
    expect(rest).toEqual(["*", "*", "*"]);
    expect(Number(minute)).toBeGreaterThanOrEqual(0);
    // Late enough for the sweep (45-minute timeout) to have finished.
    expect(Number(hour)).toBeGreaterThanOrEqual(1);
    expect(Number(hour)).toBeLessThan(20);
    expect(workflow.on.workflow_dispatch).not.toBeUndefined();
  });

  it("invokes the check command rather than reimplementing it", () => {
    const runs = (workflow.jobs["check"]?.steps ?? []).map((s) => s.run ?? "").join("\n");
    expect(runs).toContain("check:collection");
  });

  it("reads the repository and nothing more, by default", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
  });

  it("gives the database credential to the check step and no other", () => {
    const holders = Object.entries(workflow.jobs).flatMap(([job, { steps }]) =>
      steps
        .filter((s) => Object.values(s.env ?? {}).some((v) => v.includes("secrets.")))
        .map((s) => `${job}:${s.name ?? ""}`),
    );
    expect(holders).toEqual(["check:Check"]);
    const check = workflow.jobs["check"]?.steps.find((s) => s.name === "Check");
    expect(check?.env?.["DATABASE_URL"]).toBe(SECRET);
  });

  it("lets only the alert jobs write, only to issues, and only after the check", () => {
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (name === "check") {
        expect(job.permissions).toBeUndefined();
        continue;
      }
      expect(job.needs).toBe("check");
      expect(job.permissions).toEqual({ contents: "read", issues: "write" });
    }
    expect(workflow.jobs["alert"]?.if).toBe("failure()");
    expect(workflow.jobs["resolve"]?.if).toBe("success()");
  });

  it("never writes a secret into a command", () => {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) expect(step.run ?? "").not.toContain("secrets.");
    }
  });

  // The palette reserves red for destructive actions; an alert is not one.
  it("labels the alert in blue, not red", () => {
    const runs = (workflow.jobs["alert"]?.steps ?? []).map((s) => s.run ?? "").join("\n");
    expect(runs).toContain("--color 1D76DB");
  });
});
