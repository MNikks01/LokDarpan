import pg from "pg";

import { districtsOfState } from "./load.js";
import { directoryForState, resolveDistrict, type StateDirectory } from "./resolve.js";

/**
 * Re-resolve held tenders that are still unplaced, then list what remains.
 *
 *   DATABASE_URL=<etl or owner> pnpm --filter @lokdarpan/ingestion tenders:resolve
 *   … tenders:resolve -- --dry-run
 *
 * The collector resolves every tender it sees, so a tender still listed is
 * placed on its next sighting. This reaches the ones no longer listed. It only
 * adds inferred placements to unplaced rows: an explicit district was already
 * tried when the tender was read, and a placement already held is never
 * replaced here.
 *
 * What stays unresolved is printed with the clues a person would read — the
 * chain, the location, the pincode — as the review list. Nothing is placed by
 * hand from here; a `manual` placement is reserved in the schema for a review
 * tool that records who decided (see ADR-067).
 */
interface Unplaced {
  readonly id: string;
  readonly portal_tender_id: string;
  readonly organisation_chain: string | null;
  readonly location: string | null;
  readonly pincode: string | null;
}

/** One state's unplaced tenders, resolved; returns how many placed and those left. */
async function resolveState(
  db: pg.Client,
  state: { readonly state_lgd_code: string; readonly name_en: string },
  dryRun: boolean,
): Promise<{
  readonly placed: number;
  readonly remaining: readonly Unplaced[];
  readonly hasDirectory: boolean;
}> {
  const districts = await districtsOfState(db, state.state_lgd_code);
  const directory: StateDirectory = await directoryForState(db, state.name_en);
  const unplaced = await db.query<Unplaced>(
    `SELECT t.id, t.portal_tender_id, t.organisation_chain, t.location, t.pincode
       FROM tender t
       JOIN tender_collection_window w ON w.portal_code = t.portal_code
      WHERE w.state_lgd_code = $1 AND t.admin_unit_id IS NULL
      ORDER BY t.id`,
    [state.state_lgd_code],
  );

  let placed = 0;
  const remaining: Unplaced[] = [];
  for (const row of unplaced.rows) {
    const result = resolveDistrict(
      { districtName: null, districtSource: null, pincode: row.pincode, location: row.location },
      districts,
      directory,
    );
    if (result.adminUnitId === null) {
      remaining.push(row);
      continue;
    }
    placed++;
    if (dryRun) continue;
    await db.query(
      `UPDATE tender
          SET admin_unit_id = $2, district_source = $3, linkage_confidence = $4,
              district_evidence_sha256 = $5, district_evidence_key = $6,
              district_resolved_at = now()
        WHERE id = $1 AND admin_unit_id IS NULL`,
      [
        row.id,
        result.adminUnitId,
        result.method,
        result.confidence,
        result.evidenceSha256,
        result.evidenceKey,
      ],
    );
  }
  return { placed, remaining, hasDirectory: directory.sha256 !== null };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78); // EX_CONFIG
  }
  const would = dryRun ? "would be " : "";
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const states = await db.query<{ state_lgd_code: string; name_en: string }>(
      `SELECT DISTINCT w.state_lgd_code, s.name_en
         FROM tender_collection_window w
         JOIN admin_unit s ON s.level = 'state' AND s.lgd_code = w.state_lgd_code
        ORDER BY s.name_en`,
    );
    let placedTotal = 0;
    let remainingTotal = 0;
    for (const state of states.rows) {
      const { placed, remaining, hasDirectory } = await resolveState(db, state, dryRun);
      placedTotal += placed;
      remainingTotal += remaining.length;
      process.stdout.write(
        `${state.name_en}: ${String(placed)} ${would}placed, ` +
          `${String(remaining.length)} unresolved${hasDirectory ? "" : " · no directory loaded"}\n`,
      );
      for (const row of remaining.slice(0, 5)) {
        process.stdout.write(
          `  review ${row.portal_tender_id} · ${row.organisation_chain ?? "(no chain)"} · ` +
            `${row.location ?? "(no location)"} · ${row.pincode ?? "(no pincode)"}\n`,
        );
      }
    }
    process.stdout.write(
      `${String(placedTotal)} ${would}placed, ${String(remainingTotal)} left for review\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
