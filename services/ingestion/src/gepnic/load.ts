import type pg from "pg";

import { completeRun, failRun, openRun, type RunCounts } from "../ingestion-run";
import { normalise, type TenderDetail } from "./detail";
import type { FetchedArtifact } from "./fetch";
import type { ParsedTender } from "./landing";

/**
 * Writing tenders into the ledger.
 *
 * Upserts on the portal's own opaque id, so a tender seen again tomorrow
 * advances its `last_seen_at` rather than arriving a second time. The reference
 * number is never the key: one reference covered six distinct tenders on the
 * day this was written.
 */

export interface TenderRecord {
  readonly listed: ParsedTender;
  /** Null where the detail page could not be read; the tender is still held. */
  readonly detail: TenderDetail | null;
}

export interface LoadOptions {
  readonly portalCode: string;
  readonly stateLgdCode: string;
  readonly records: readonly TenderRecord[];
  readonly artifact: FetchedArtifact;
  readonly datasetDescription: string;
}

export interface LoadResult {
  readonly inserted: number;
  /** Existing tenders seen again, whether or not anything about them differed. */
  readonly updated: number;
  /**
   * Existing tenders whose source-controlled fields actually changed — the ones
   * that produced a `tender_version`.
   *
   * Counted separately from `updated` because a run in which every tender was
   * seen and none had changed is a healthy run, and it is indistinguishable
   * from a run that collected nothing unless the two are counted apart.
   */
  readonly changed: number;
  readonly placed: number;
  readonly failed: readonly { readonly portalTenderId: string; readonly reason: string }[];
  /** The run this load is recorded under. */
  readonly ingestionRunId: number;
}

/**
 * How far to trust a district placement.
 *
 * `chain_unit` is a segment of the organisation chain that IS a district, as
 * the portal itself wrote it. `office_code` is a district name found inside an
 * office name like `CE-Tirunelveli`, and such an office covers more than its
 * own district — so that placement is plausible rather than stated, and the
 * number says so. Neither is 1.0: even a clean segment names the issuing
 * office, not the work site.
 */
const LINKAGE_CONFIDENCE: Readonly<Record<"chain_unit" | "office_code", number>> = {
  chain_unit: 0.9,
  office_code: 0.6,
};

/**
 * The districts of one state, keyed by normalised name.
 *
 * Scoped to a single state deliberately. The normalisation collapses eighteen
 * pairs of distinct districts nationwide — Pune with Panna among them — and
 * within one state it collapses none. See `districtFromChain`.
 */
export async function districtsOfState(
  db: pg.Client,
  stateLgdCode: string,
): Promise<ReadonlyMap<string, number>> {
  const result = await db.query<{ id: string; name_en: string }>(
    `SELECT d.id, d.name_en
       FROM admin_unit d
       JOIN admin_unit s ON s.id = d.parent_id
      WHERE d.level = 'district' AND s.level = 'state' AND s.lgd_code = $1`,
    [stateLgdCode],
  );
  const byName = new Map<string, number>();
  for (const row of result.rows) byName.set(normalise(row.name_en), Number(row.id));
  return byName;
}

interface Placement {
  readonly adminUnitId: number | null;
  readonly source: string | null;
  readonly confidence: number | null;
}

const UNPLACED: Placement = { adminUnitId: null, source: null, confidence: null };

export function placementFor(
  detail: TenderDetail | null,
  districts: ReadonlyMap<string, number>,
): Placement {
  const name = detail?.districtName;
  const source = detail?.districtSource;
  if (name === undefined || name === null || source === undefined || source === null) {
    return UNPLACED;
  }
  const id = districts.get(normalise(name));
  // A name that does not resolve leaves the tender unplaced rather than
  // approximately placed. Missing is never zero, and a wrong district is a
  // false statement about where public money is going.
  if (id === undefined) return UNPLACED;
  return { adminUnitId: id, source, confidence: LINKAGE_CONFIDENCE[source] };
}

/**
 * The detail-derived columns, in the order the insert lists them.
 *
 * All null together when the page could not be read, which the upsert's
 * COALESCE then treats as "tells us nothing" rather than "is now nothing".
 */
function detailParameters(detail: TenderDetail | null, districtSource: string | null): unknown[] {
  if (detail === null)
    return [null, null, districtSource, null, null, null, null, null, null, null];
  return [
    detail.department,
    detail.organisationChain.join("||"),
    districtSource,
    detail.location,
    detail.pincode,
    detail.tenderCategory,
    detail.productCategory,
    detail.tenderType,
    detail.tenderValuePaise?.toString() ?? null,
    detail.emdPaise?.toString() ?? null,
  ];
}

function parameters(
  record: TenderRecord,
  place: Placement,
  context: { portalCode: string; sha256: string; datasetVersionId: string },
): unknown[] {
  return [
    context.portalCode,
    record.listed.portalTenderId,
    record.listed.tenderReference,
    record.listed.title,
    record.listed.closingAt,
    record.listed.bidOpeningAt,
    place.adminUnitId,
    place.confidence,
    context.sha256,
    context.datasetVersionId,
    // The reading of the page is unambiguous; this is not a claim that the
    // government's own figures are right.
    0.95,
    ...detailParameters(record.detail, place.source),
  ];
}

const UPSERT = `
  INSERT INTO tender (
    portal_code, portal_tender_id, tender_reference, title,
    closing_at, bid_opening_at, admin_unit_id, linkage_confidence,
    source_sha256, dataset_version_id, extraction_confidence,
    department, organisation_chain, district_source,
    location, pincode, tender_category, product_category, tender_type,
    tender_value_paise, emd_paise, first_seen_at, last_seen_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
    $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, now(), now()
  )
  ON CONFLICT (portal_code, portal_tender_id) DO UPDATE SET
    last_seen_at = now(),
    dataset_version_id = EXCLUDED.dataset_version_id,

    -- COALESCE, IN THAT ORDER, FOR TWO DIFFERENT REASONS.
    --
    -- The new value wins where there is one, because these fields are DERIVED
    -- by us — the district comes from our resolver, not from the sighting — and
    -- an improved resolver should correct rows it previously left unplaced.
    --
    -- The old value survives where the new is null, because a detail page that
    -- failed to load produces nulls for every one of these. Without the
    -- fallback, one unreachable page would quietly erase a department and a
    -- placement we already held and reported the run as a success.
    admin_unit_id = COALESCE(EXCLUDED.admin_unit_id, tender.admin_unit_id),
    linkage_confidence = COALESCE(EXCLUDED.linkage_confidence, tender.linkage_confidence),
    district_source = COALESCE(EXCLUDED.district_source, tender.district_source),
    department = COALESCE(EXCLUDED.department, tender.department),
    organisation_chain = COALESCE(EXCLUDED.organisation_chain, tender.organisation_chain),
    location = COALESCE(EXCLUDED.location, tender.location),
    pincode = COALESCE(EXCLUDED.pincode, tender.pincode),
    tender_category = COALESCE(EXCLUDED.tender_category, tender.tender_category),
    product_category = COALESCE(EXCLUDED.product_category, tender.product_category),
    tender_type = COALESCE(EXCLUDED.tender_type, tender.tender_type),
    tender_value_paise = COALESCE(EXCLUDED.tender_value_paise, tender.tender_value_paise),
    emd_paise = COALESCE(EXCLUDED.emd_paise, tender.emd_paise)
    -- first_seen_at is deliberately absent: it records when we began holding
    -- this tender, and rewriting it would erase the collection history.
  RETURNING (xmax = 0) AS inserted`;

/**
 * The floor on the data, moved after a successful load.
 *
 * Without a window a reader cannot tell "nothing was advertised" from "we were
 * not looking yet", and the second reads as the first. `collecting_since` is set
 * once and never moved.
 *
 * `state_lgd_code` is written on every run rather than backfilled: the portal's
 * own code is not evidence of which state it serves.
 */
async function recordSuccessfulCollection(
  db: pg.Client,
  portalCode: string,
  stateLgdCode: string,
): Promise<void> {
  await db.query(
    `INSERT INTO tender_collection_window
       (portal_code, collecting_since, last_success_at, last_checked_at, state_lgd_code)
     VALUES ($1, CURRENT_DATE, now(), now(), $2)
     ON CONFLICT (portal_code) DO UPDATE SET
       last_success_at = now(),
       last_checked_at = now(),
       state_lgd_code = EXCLUDED.state_lgd_code`,
    [portalCode, stateLgdCode],
  );
}

/**
 * The artefact these tenders were read from, and the vintage they belong to.
 *
 * Both are written before any tender, so every row a load produces can point
 * back at the bytes it came from.
 */
async function openArtifactAndVersion(db: pg.Client, options: LoadOptions): Promise<string> {
  const { portalCode, artifact } = options;
  await db.query(
    `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status, content_type, byte_size, storage_path)
     VALUES ($1, $2, $3, $4, 200, 'text/html', $5, $6)
     ON CONFLICT (sha256) DO NOTHING`,
    [
      artifact.sha256,
      `gepnic-${portalCode}`,
      artifact.sourceUrl,
      artifact.retrievedAt,
      artifact.byteSize,
      `gepnic/${portalCode}/${artifact.sha256}.html`,
    ],
  );

  const version = await db.query<{ id: string }>(
    `INSERT INTO dataset_version (description) VALUES ($1) RETURNING id`,
    [options.datasetDescription],
  );
  const datasetVersionId = version.rows[0]?.id;
  if (datasetVersionId === undefined) throw new Error("could not open a dataset version");
  return datasetVersionId;
}

/**
 * One tender, inside its own savepoint.
 *
 * Postgres aborts the whole transaction on the first failed statement, so
 * without a savepoint per tender one malformed row loses the entire day's
 * collection under an error naming none of them.
 */
async function writeOne(
  db: pg.Client,
  record: TenderRecord,
  districts: ReadonlyMap<string, number>,
  context: { portalCode: string; sha256: string; datasetVersionId: string },
): Promise<{ readonly inserted: boolean; readonly placed: boolean }> {
  await db.query("SAVEPOINT tender");
  try {
    const place = placementFor(record.detail, districts);
    const row = await db.query<{ inserted: boolean }>(UPSERT, parameters(record, place, context));
    await db.query("RELEASE SAVEPOINT tender");
    return { inserted: row.rows[0]?.inserted === true, placed: place.adminUnitId !== null };
  } catch (error: unknown) {
    await db.query("ROLLBACK TO SAVEPOINT tender");
    throw error;
  }
}

/**
 * Every tender in the run, each in its own savepoint.
 *
 * Separated from `loadTenders` so that the transaction's shape — open a run,
 * write, close it — reads in one screen, and so the counting lives beside the
 * writing it counts.
 */
async function writeAll(
  db: pg.Client,
  records: readonly TenderRecord[],
  districts: ReadonlyMap<string, number>,
  context: { portalCode: string; sha256: string; datasetVersionId: string },
): Promise<{
  readonly inserted: number;
  readonly updated: number;
  readonly placed: number;
  readonly failed: readonly { readonly portalTenderId: string; readonly reason: string }[];
}> {
  let inserted = 0;
  let updated = 0;
  let placed = 0;
  const failed: { portalTenderId: string; reason: string }[] = [];

  for (const record of records) {
    try {
      const one = await writeOne(db, record, districts, context);
      if (one.placed) placed++;
      if (one.inserted) inserted++;
      else updated++;
    } catch (error: unknown) {
      // `writeOne` has already rewound to its savepoint, so the transaction is
      // usable and this records what was lost rather than repairing anything.
      failed.push({
        portalTenderId: record.listed.portalTenderId,
        reason: error instanceof Error ? (error.message.split("\n")[0] ?? "unknown") : "unknown",
      });
    }
  }

  return { inserted, updated, placed, failed };
}

interface Tally {
  readonly seen: number;
  readonly inserted: number;
  /** Existing rows touched, whether or not anything differed. */
  readonly updated: number;
  /** Of those, the ones that produced a version. */
  readonly changed: number;
  readonly placed: number;
  readonly rejected: number;
}

/**
 * What a run saw, in the terms `ingestion_run` records.
 *
 * `unchanged` is derived rather than counted per row, so the loop stays one
 * statement per tender. It is the figure most easily left out and the most
 * useful: a run where every tender was seen and none had changed is healthy, and
 * without it that is indistinguishable from a run that collected nothing.
 */
function countsOf(tally: Tally): RunCounts {
  return {
    seen: tally.seen,
    inserted: tally.inserted,
    updated: tally.changed,
    unchanged: tally.updated - tally.changed,
    rejected: tally.rejected,
    // Held, valid, and not attributable to a district. Never a rejection.
    unresolved: tally.inserted + tally.updated - tally.placed,
    errors: tally.rejected,
  };
}

export async function loadTenders(db: pg.Client, options: LoadOptions): Promise<LoadResult> {
  const { portalCode, stateLgdCode, records, artifact } = options;
  const failed: { portalTenderId: string; reason: string }[] = [];
  let inserted = 0;
  let updated = 0;
  let placed = 0;
  let changed = 0;

  // Opened before the transaction and closed after it, on purpose: a failed
  // load must roll the ledger back and must not roll back the account of the
  // failure. See `ingestion-run.ts`.
  const ingestionRunId = await openRun(db, `gepnic-${portalCode}`);

  // The attempt is recorded whether or not it succeeds, and only for a portal
  // already being collected. Inserting a window here would set
  // `collecting_since` for a portal whose first run failed, which would claim
  // collection began on a day nothing was collected.
  await db.query(
    `UPDATE tender_collection_window SET last_checked_at = now() WHERE portal_code = $1`,
    [portalCode],
  );

  const counts = (): RunCounts =>
    countsOf({ seen: records.length, inserted, updated, changed, placed, rejected: failed.length });

  await db.query("BEGIN");
  try {
    // How much history existed before this run, so the versions the trigger
    // writes during it can be counted without asking per tender.
    const before = await db.query<{ high: string | null }>(
      `SELECT max(id)::text AS high FROM tender_version`,
    );
    const highWaterMark = before.rows[0]?.high ?? "0";
    const datasetVersionId = await openArtifactAndVersion(db, options);

    const districts = await districtsOfState(db, stateLgdCode);

    const written = await writeAll(db, records, districts, {
      portalCode,
      sha256: artifact.sha256,
      datasetVersionId,
    });
    inserted = written.inserted;
    updated = written.updated;
    placed = written.placed;
    failed.push(...written.failed);

    // How many versions the trigger wrote during this run — that is, how many
    // tenders the portal actually changed. Counted once against a high-water
    // mark rather than per tender, so the loop stays one statement each.
    const versions = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM tender_version WHERE id > $1::bigint`,
      [highWaterMark],
    );
    changed = Number(versions.rows[0]?.count ?? "0");

    await recordSuccessfulCollection(db, portalCode, stateLgdCode);

    await db.query("COMMIT");
  } catch (error: unknown) {
    await db.query("ROLLBACK");
    // The ledger keeps what it had; the run says what happened. Counts are not
    // zeroed — a run that read four hundred records before failing saw four
    // hundred, and reporting none would state the failure as an absence.
    await failRun(db, ingestionRunId, error instanceof Error ? error.message : String(error), {
      ...counts(),
      errors: Math.max(1, failed.length),
    });
    throw error;
  }

  await completeRun(db, ingestionRunId, counts());
  return { inserted, updated, changed, placed, failed, ingestionRunId };
}
