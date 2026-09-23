/**
 * The explorer's performance budgets, in one place (ADR-062).
 *
 * `documented` numbers come from `.docs/02-architecture/web-architecture.md`.
 * `proposal` numbers come from the adoption plan and are to be ratified once
 * a baseline has been captured: a budget set before measurement is a guess with
 * a decimal point.
 *
 * `ci` budgets are deterministic (bytes from the build) and fail a build over
 * their ceiling. `nightly` budgets are runtime measurements, which vary with
 * the machine, and only warn.
 */

export type Unit = "bytes" | "ms";
export type Profile = "desktop" | "mobile";

export interface Budget {
  readonly id: string;
  readonly metric: string;
  readonly unit: Unit;
  /** Null where the budget applies to every profile or to none (bytes). */
  readonly profile: Profile | null;
  readonly target: number;
  /** Null where no ceiling has been set. */
  readonly ceiling: number | null;
  readonly basis: "documented" | "proposal";
  readonly gate: "ci" | "nightly";
}

const KB = 1024;

export const BUDGETS: readonly Budget[] = [
  {
    id: "explore.initial-js",
    metric: "Initial JS for /explore, gzip",
    unit: "bytes",
    profile: null,
    target: 400 * KB,
    ceiling: 600 * KB,
    basis: "documented",
    gate: "ci",
  },
  {
    id: "explore.html",
    metric: "HTML for /explore, gzip",
    unit: "bytes",
    profile: null,
    target: 60 * KB,
    ceiling: 120 * KB,
    basis: "documented",
    gate: "nightly",
  },
  {
    id: "level.payload",
    metric: "One level's payload (units, coverage, boundaries), gzip",
    unit: "bytes",
    profile: null,
    target: 150 * KB,
    ceiling: 500 * KB,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "level.api",
    metric: "Level endpoint response, origin warm",
    unit: "ms",
    profile: null,
    target: 300,
    ceiling: 800,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "rail.usable",
    metric: "Rail interactive (explorer hydrated), cold",
    unit: "ms",
    profile: "mobile",
    target: 2500,
    ceiling: 4000,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "map.load.cold",
    metric: "map:load, cold",
    unit: "ms",
    profile: "desktop",
    target: 2000,
    ceiling: 15000,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "map.load.cold",
    metric: "map:load, cold",
    unit: "ms",
    profile: "mobile",
    target: 5000,
    ceiling: 15000,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "map.load.warm",
    metric: "map:load, warm",
    unit: "ms",
    profile: "desktop",
    target: 1000,
    ceiling: null,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "map.load.warm",
    metric: "map:load, warm",
    unit: "ms",
    profile: "mobile",
    target: 2500,
    ceiling: null,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "map.first-boundaries",
    metric: "First boundaries drawn after map:load",
    unit: "ms",
    profile: null,
    target: 500,
    ceiling: 1500,
    basis: "proposal",
    gate: "nightly",
  },
  {
    id: "select.boundaries-drawn",
    metric: "Select a unit → its child boundaries drawn",
    unit: "ms",
    profile: "mobile",
    target: 800,
    ceiling: 2000,
    basis: "proposal",
    gate: "nightly",
  },
];

export type Verdict = "within" | "over-target" | "over-ceiling";

export function judge(budget: Budget, value: number): Verdict {
  if (budget.ceiling !== null && value > budget.ceiling) return "over-ceiling";
  return value > budget.target ? "over-target" : "within";
}

/** The budgets that apply to a metric under a profile. */
export function budgetsFor(id: string, profile: Profile | null): readonly Budget[] {
  return BUDGETS.filter((b) => b.id === id && (b.profile === null || b.profile === profile));
}

/** Median and 75th percentile, nearest-rank. Nothing is discarded. */
export function summarise(values: readonly number[]): {
  readonly n: number;
  readonly median: number;
  readonly p75: number;
} {
  if (values.length === 0) return { n: 0, median: Number.NaN, p75: Number.NaN };
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p: number): number => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? 0;
  return { n: sorted.length, median: rank(0.5), p75: rank(0.75) };
}

export function formatValue(unit: Unit, value: number): string {
  return unit === "bytes" ? `${(value / KB).toFixed(1)} KB` : `${String(Math.round(value))} ms`;
}
