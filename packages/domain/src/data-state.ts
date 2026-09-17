/**
 * What is known about a piece of data before any of its figures are shown.
 *
 * WHY ONE MODEL
 * The ledger already answers these questions in separate vocabularies: tender
 * collection (`not_collected / collected / stale / failing`), geography coverage
 * (`complete / partial / not_collected`), and ingestion runs. Each panel then
 * turned its own vocabulary into sentences its own way, and a new source would
 * have added another. This is the one shape they all map into, and the one place
 * that decides what may be shown.
 * `.docs/adr/054-collected-current-and-complete-are-three-questions.md`.
 *
 * THREE QUESTIONS, NOT ONE STATUS
 * - Is it collected at all?
 * - Is what we hold current?
 * - Is what we hold everything the source publishes?
 * They are independent: tenders can be both stale and incomplete. A single enum
 * forces a choice between true statements, so they stay separate here and are
 * combined only when a panel needs one headline (`displayStateOf`).
 *
 * WHAT IS DELIBERATELY ABSENT
 * There is no "not published" state. Saying a government did not publish
 * something needs evidence that its listing was read and the item was absent,
 * and nothing records that yet. A category defined before anything can go in it
 * invites guesses to fill it (the same reasoning as ADR-051).
 */

export type Collection = "collected" | "not_collected" | "unknown";
export type Freshness = "fresh" | "stale" | "failing" | "unknown";
export type Completeness = "complete" | "partial" | "unknown";

export interface DataState {
  readonly collection: Collection;
  readonly freshness: Freshness;
  readonly completeness: Completeness;
  /** Last collection that loaded successfully. */
  readonly lastSuccessAt: string | null;
  /** Last attempt, successful or not. */
  readonly lastCheckedAt: string | null;
  /** Collection is forward-only: records from before this date are not held. */
  readonly collectingSince: string | null;
  /** How `partial` is known, in the words recorded with it. Null otherwise. */
  readonly note: string | null;
  /** Registry ids of the sources this state describes (see `source-licence.ts`). */
  readonly sourceIds: readonly string[];
}

/**
 * The one headline a panel shows.
 *
 * `current` and `held` are different claims. `current` means collection is
 * scheduled and succeeded recently. `held` means we hold it and have no schedule
 * against which to call it current or stale, which is true of boundaries.
 * `loading` and `unavailable` describe the request, not the data.
 */
export type DisplayState =
  | "loading"
  | "unavailable"
  | "not_collected"
  | "unknown"
  | "failing"
  | "stale"
  | "partial"
  | "current"
  | "held";

export type Transport = "loading" | "ok" | "unavailable";

/**
 * Which headline wins when several are true.
 *
 * A failed request comes first: it says nothing about the data, and must not be
 * read as anything about the publisher. Then whether anything is collected,
 * because every later state is a statement about data we hold. Then whether the
 * holdings are current, and only then whether they are whole.
 */
export function displayStateOf(state: DataState | null, transport: Transport): DisplayState {
  if (transport !== "ok") return transport;
  if (state === null || state.collection === "unknown") return "unknown";
  if (state.collection === "not_collected") return "not_collected";
  if (state.freshness === "failing" || state.freshness === "stale") return state.freshness;
  if (state.completeness === "partial") return "partial";
  return state.freshness === "fresh" ? "current" : "held";
}

/**
 * Whether any count or figure may be shown alongside this state.
 *
 * Only for data we collect. For anything else, a count measures our reach and
 * presents it as a fact about a government: "0 tenders" for a state whose portal
 * nobody collects is true and misleading (ADR-048). Stale, failing and partial
 * data may be shown, with their state beside them.
 */
export function mayShowCounts(state: DataState | null): boolean {
  return state !== null && state.collection === "collected";
}

const EMPTY: Omit<DataState, "collection" | "freshness" | "completeness"> = {
  lastSuccessAt: null,
  lastCheckedAt: null,
  collectingSince: null,
  note: null,
  sourceIds: [],
};

/** A state's tender collection, as `PostgresTenderRepository.collectionForState` reports it. */
export interface TenderCollectionInput {
  readonly status: "not_collected" | "collected" | "stale" | "failing";
  readonly portalCode: string | null;
  readonly collectingSince: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastCheckedAt: string | null;
}

/**
 * Tender collection for one state.
 *
 * Completeness is `unknown`, not `complete`. A portal's listing is read daily,
 * but nothing checks that every tender it advertises was captured, and the
 * collection window means tenders from before it are not held at all.
 */
export function tenderCollectionState(input: TenderCollectionInput): DataState {
  if (input.status === "not_collected") {
    return { ...EMPTY, collection: "not_collected", freshness: "unknown", completeness: "unknown" };
  }
  return {
    ...EMPTY,
    collection: "collected",
    freshness: input.status === "collected" ? "fresh" : input.status,
    completeness: "unknown",
    lastSuccessAt: input.lastSuccessAt,
    lastCheckedAt: input.lastCheckedAt,
    collectingSince: input.collectingSince,
    sourceIds: input.portalCode === null ? [] : [`gepnic-${input.portalCode}`],
  };
}

/** Coverage of one administrative level, as `geography_coverage` records it. */
export interface LevelCoverageInput {
  readonly status: "complete" | "partial" | "not_collected";
  readonly note: string | null;
  readonly sourceId: string;
  readonly checkedAt: string;
}

/**
 * Geography held at one level.
 *
 * Freshness is `unknown`: boundaries are loaded on demand, not on a schedule,
 * so there is no expected interval against which to call them current or stale.
 */
export function levelCoverageState(input: LevelCoverageInput): DataState {
  const base = { ...EMPTY, lastCheckedAt: input.checkedAt, sourceIds: [input.sourceId] };
  if (input.status === "not_collected") {
    return { ...base, collection: "not_collected", freshness: "unknown", completeness: "unknown" };
  }
  return {
    ...base,
    collection: "collected",
    freshness: "unknown",
    completeness: input.status,
    note: input.status === "partial" ? input.note : null,
  };
}
