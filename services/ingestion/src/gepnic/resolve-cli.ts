import pg from "pg";

import { aliasesOfState } from "./aliases.js";
import { districtFromChain } from "./detail.js";
import { districtsOfState } from "./load.js";
import {
  directoryForState,
  resolveDistrict,
  type StateDirectory,
  type TenderClues,
} from "./resolve.js";

/**
 * Re-resolve held tenders that are still unplaced, then list what remains.
 *
 *   DATABASE_URL=<etl or owner> pnpm --filter @lokdarpan/ingestion tenders:resolve
 *   … tenders:resolve -- --dry-run
 *
 * The collector resolves every tender it sees, so a tender still listed is
 * placed on its next sighting. This reaches the ones no longer listed, and
 * those read before a rule improved: the explicit step is re-run over each
 * stored organisation chain, with the district names and approved aliases the
 * ledger holds now, before the pincode and place-name steps. It only touches
 * unplaced rows; a placement already held is never replaced here.
 *
 * A tender a reviewer has decided (migration 0035) — placed, or recorded as
 * one that cannot be placed — is not listed again.
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

/** What a stored tender says, with its chain read again by today's rules. */
function cluesOf(row: Unplaced, known: ReadonlySet<string>): TenderClues {
  const named =
    row.organisation_chain === null
      ? null
      : districtFromChain(row.organisation_chain.split("||"), known);
  return {
    districtName: named?.name ?? null,
    districtSource: named?.source ?? null,
    pincode: row.pincode,
    location: row.location,
  };
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
  const aliases = await aliasesOfState(db, state.state_lgd_code);
  const known = new Set([...districts.keys(), ...aliases.keys()]);
  const unplaced = await db.query<Unplaced>(
    `SELECT t.id, t.portal_tender_id, t.organisation_chain, t.location, t.pincode
       FROM tender t
       JOIN tender_collection_window w ON w.portal_code = t.portal_code
      WHERE w.state_lgd_code = $1 AND t.admin_unit_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM tender_district_decision d WHERE d.tender_id = t.id)
      ORDER BY t.id`,
    [state.state_lgd_code],
  );

  let placed = 0;
  const remaining: Unplaced[] = [];
  for (const row of unplaced.rows) {
    const result = resolveDistrict(cluesOf(row, known), districts, directory, aliases);
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
