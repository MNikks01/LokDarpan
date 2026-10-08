import {
  displayStateOf,
  levelCoverageState,
  tenderCollectionState,
  type DataState,
  type DisplayState,
  type LevelCoverageInput,
  type TenderCollectionInput,
} from "./data-state";
import type { AdminUnitLevel } from "./admin-unit";
import type { PublicationDecision } from "./source-licence";

/**
 * What LokDarpan holds for a place, one row per kind of record (LD-009, ADR-076).
 *
 * WHY A CHECKLIST
 * A page that shows only what it has lets a reader take every absence for a
 * fact about the government. A Unit page with no budget section reads as "this
 * state publishes no budget", when the truth may be "LokDarpan holds this
 * state's budget and may not show it yet". So every kind of record the platform
 * deals in gets a row on the page, saying which is true: collected and shown,
 * collected and withheld, not collected, or unknown.
 *
 * THE FOURTH QUESTION
 * `DataState` answers three questions: collected, current, complete (ADR-054).
 * Whether what is held may be shown is a fourth, and a different kind of fact:
 * it belongs to the publisher's terms and the permissions on record, not to
 * the collection. It is answered here by the publication gate (ADR-073), which
 * the caller passes in as `decide`. This package does no I/O, and no row can
 * say "shown" or "withheld" on anything but the gate's word.
 */

export type HoldingLayer = "boundaries" | "audit_reports" | "tenders" | "budget" | "works";

/**
 * Whether what is held may be shown.
 *
 * `counts_only`: the count is ours to state, the records are not (tender
 * details, ADR-056). Null when nothing is held: there is nothing to show or
 * withhold.
 */
export type Showing = "shown" | "counts_only" | "withheld";

export interface Holding {
  readonly layer: HoldingLayer;
  /** For boundaries, the level the row is about. Null for every other layer. */
  readonly level: AdminUnitLevel | null;
  readonly state: DataState;
  readonly showing: Showing | null;
  /**
   * How many are held, only where a count may be shown: collected, and not
   * withheld by the gate. Never a zero standing in for "not collected".
   */
  readonly count: number | null;
  /**
   * Where the records are filed, when that is not this unit. Audit reports and
   * budgets are filed under a state, so a district page says so rather than
   * reporting none of its own.
   */
  readonly filedUnder: { readonly unitId: number; readonly name: string } | null;
}

/** The one word a row leads with. `withheld` outranks the collection's own state. */
export type HoldingHeadline = DisplayState | "withheld";

export function holdingHeadline(holding: Holding): HoldingHeadline {
  if (holding.state.collection === "collected" && holding.showing === "withheld") {
    return "withheld";
  }
  return displayStateOf(holding.state, "ok");
}

/** The gate, as the server applies it with its switches and recorded grants. */
export type Decide = (sourceId: string) => PublicationDecision;

const NOTHING: Omit<DataState, "collection" | "freshness" | "completeness" | "sourceIds"> = {
  lastSuccessAt: null,
  lastCheckedAt: null,
  collectingSince: null,
  note: null,
};

function notCollected(sourceId: string): DataState {
  return {
    ...NOTHING,
    collection: "not_collected",
    freshness: "unknown",
    completeness: "unknown",
    sourceIds: [sourceId],
  };
}

/** Collected on demand rather than on a schedule, so neither current nor stale. */
function heldOnDemand(sourceId: string, lastSuccessAt: string | null): DataState {
  return {
    ...NOTHING,
    collection: "collected",
    freshness: "unknown",
    completeness: "unknown",
    lastSuccessAt,
    sourceIds: [sourceId],
  };
}

function showingOf(decide: Decide, sourceId: string): Showing {
  return decide(sourceId).publishable ? "shown" : "withheld";
}

/** A count, only where the gate lets it be shown. */
function countIf(showing: Showing, count: number): number | null {
  return showing === "withheld" ? null : count;
}

/**
 * The levels a unit's page reports boundaries for: those directly below it in
 * the hierarchy as the ledger records it. A district has two, because talukas
 * and urban local bodies are both its children, and a reader looking for a
 * municipality must be told whether those are held as plainly as talukas.
 */
export const LEVELS_BELOW: Readonly<Record<AdminUnitLevel, readonly AdminUnitLevel[]>> = {
  country: ["state"],
  state: ["district"],
  district: ["sub_district", "urban_local_body"],
  sub_district: ["village"],
  block: ["gram_panchayat"],
  urban_local_body: ["ward"],
  village: [],
  ward: [],
  gram_panchayat: [],
};

export interface BoundaryInput {
  readonly level: AdminUnitLevel;
  /** Units held at this level directly under the page's unit. */
  readonly held: number;
  /** The nearest recorded finding for this level, or null where none is recorded. */
  readonly coverage: LevelCoverageInput | null;
}

const BOUNDARY_SOURCE = "openstreetmap-overpass";

/**
 * Boundaries held one level down.
 *
 * A recorded coverage finding wins when units are held, because someone looked.
 * With none held, the row says not collected whatever the finding says: a
 * finding describes what was loaded somewhere, and this ledger holding nothing
 * here is the fact that matters on this page. Without a finding, units held
 * means collected with completeness unknown.
 */
export function boundaryHolding(input: BoundaryInput, decide: Decide): Holding {
  const base = { layer: "boundaries" as const, level: input.level, filedUnder: null };
  if (input.held === 0) {
    return { ...base, state: notCollected(BOUNDARY_SOURCE), showing: null, count: null };
  }
  const state =
    input.coverage === null
      ? heldOnDemand(BOUNDARY_SOURCE, null)
      : levelCoverageState(input.coverage);
  const showing = showingOf(decide, state.sourceIds[0] ?? BOUNDARY_SOURCE);
  return { ...base, state, showing, count: countIf(showing, input.held) };
}

export interface FiledInput {
  /** Records filed under the state. */
  readonly held: number;
  /** When the most recent of them was retrieved or loaded. */
  readonly lastAt: string | null;
  /** The state they are filed under, when the page is for a unit below it. */
  readonly filedUnder: Holding["filedUnder"];
}

function filedHolding(
  layer: "audit_reports" | "budget",
  sourceId: string,
  input: FiledInput,
  decide: Decide,
): Holding {
  const base = { layer, level: null, filedUnder: input.filedUnder };
  if (input.held === 0) {
    return { ...base, state: notCollected(sourceId), showing: null, count: null };
  }
  const showing = showingOf(decide, sourceId);
  return {
    ...base,
    state: heldOnDemand(sourceId, input.lastAt),
    showing,
    count: countIf(showing, input.held),
  };
}

/**
 * Audit reports filed under the state, by the publisher's own classification.
 *
 * Completeness is unknown: nothing checks the CAG's listing for reports not
 * taken. Freshness is unknown: reports are collected on demand.
 */
export function auditHolding(input: FiledInput, decide: Decide): Holding {
  return filedHolding("audit_reports", "cag", input, decide);
}

/** Departments with budget, release and expenditure figures held for the state (BEAMS). */
export function budgetHolding(input: FiledInput, decide: Decide): Holding {
  return filedHolding("budget", "beams", input, decide);
}

/**
 * Tender collection for the state the page sits in.
 *
 * Counts are ours to state; the tenders' details are the issuing departments'
 * (ADR-056). A collected state is therefore `counts_only` unless the gate opens
 * the details too.
 */
export function tenderHolding(
  input: TenderCollectionInput,
  decide: Decide,
  filedUnder: Holding["filedUnder"] = null,
): Holding {
  const state = tenderCollectionState(input);
  let showing: Showing | null = null;
  if (state.collection === "collected") {
    showing = decide(state.sourceIds[0] ?? "gepnic").publishable ? "shown" : "counts_only";
  }
  return { layer: "tenders", level: null, state, showing, count: null, filedUnder };
}

/**
 * The progress of individual public works.
 *
 * Not collected anywhere: the one register found (PMGSY's OMMAS) may not be
 * copied without written permission, and no other has been identified in the
 * sources reviewed. The row exists so that a page never implies there is no work.
 */
export function worksHolding(): Holding {
  return {
    layer: "works",
    level: null,
    state: notCollected("pmgsy"),
    showing: null,
    count: null,
    filedUnder: null,
  };
}
