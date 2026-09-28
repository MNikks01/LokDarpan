import type pg from "pg";

/**
 * A reviewer's decision about a tender no rule could place (migration 0035).
 *
 * Either a district of the tender's own state, or `null`: "I read it and it
 * cannot honestly be put in one district". Both are recorded in
 * `tender_district_decision`, signed and reasoned, and never edited; a later
 * decision supersedes an earlier one by being later.
 *
 * CONFIDENCE 0.8
 * A person reading the tender's own text, with the chain, location and pincode
 * in front of them, is a better reader than any rule here, and still not the
 * office stating where the work is. Above an office-code match (0.6), below a
 * chain that names the district outright (0.9).
 */
export const MANUAL_CONFIDENCE = 0.8;

export interface Decision {
  /** The portal's own opaque id, with its portal: the identity the ledger keys on. */
  readonly portalCode: string;
  readonly portalTenderId: string;
  /** The district's LGD code, or null for "cannot be placed". */
  readonly districtLgdCode: string | null;
  readonly decidedBy: string;
  readonly reason: string;
}

export interface Decided {
  readonly decisionId: number;
  readonly tenderId: number;
  readonly adminUnitId: number | null;
  readonly districtName: string | null;
}

export class PlacementRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlacementRefused";
  }
}

async function findTender(
  db: pg.ClientBase,
  decision: Decision,
): Promise<{ readonly id: string; readonly stateLgdCode: string; readonly placed: boolean }> {
  const tender = await db.query<{ id: string; state_lgd_code: string | null; placed: boolean }>(
    `SELECT t.id, w.state_lgd_code, (t.admin_unit_id IS NOT NULL) AS placed
       FROM tender t
       LEFT JOIN tender_collection_window w ON w.portal_code = t.portal_code
      WHERE t.portal_code = $1 AND t.portal_tender_id = $2`,
    [decision.portalCode, decision.portalTenderId],
  );
  const row = tender.rows[0];
  if (row === undefined) {
    throw new PlacementRefused(`No tender ${decision.portalTenderId} on ${decision.portalCode}.`);
  }
  if (row.state_lgd_code === null) {
    throw new PlacementRefused(`The portal ${decision.portalCode} has no state recorded.`);
  }
  return { id: row.id, stateLgdCode: row.state_lgd_code, placed: row.placed };
}

/** The district of that state with that LGD code; any other is refused, never guessed. */
async function findDistrict(
  db: pg.ClientBase,
  stateLgdCode: string,
  districtLgdCode: string,
): Promise<{ readonly id: string; readonly name: string }> {
  const district = await db.query<{ id: string; name_en: string }>(
    `SELECT d.id, d.name_en FROM admin_unit d
       JOIN admin_unit s ON s.id = d.parent_id
      WHERE d.level = 'district' AND s.level = 'state'
        AND s.lgd_code = $1 AND d.lgd_code = $2`,
    [stateLgdCode, districtLgdCode],
  );
  const row = district.rows[0];
  if (row === undefined) {
    throw new PlacementRefused(
      `LGD ${districtLgdCode} is not a district of the tender's state (LGD ${stateLgdCode}).`,
    );
  }
  return { id: row.id, name: row.name_en };
}

/** The decision and, for a district, the placement, in one transaction. */
async function record(
  db: pg.ClientBase,
  tenderId: string,
  district: { readonly id: string } | null,
  decision: Decision,
): Promise<number> {
  await db.query("BEGIN");
  try {
    const recorded = await db.query<{ id: string }>(
      `INSERT INTO tender_district_decision (tender_id, admin_unit_id, decided_by, reason)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenderId, district?.id ?? null, decision.decidedBy.trim(), decision.reason.trim()],
    );
    const decisionId = Number(recorded.rows[0]?.id);
    if (district !== null) {
      await db.query(
        `UPDATE tender
            SET admin_unit_id = $2, district_source = 'manual', linkage_confidence = $3,
                district_evidence_sha256 = NULL, district_evidence_key = $4,
                district_resolved_at = now()
          WHERE id = $1`,
        [tenderId, district.id, MANUAL_CONFIDENCE, `decision:${String(decisionId)}`],
      );
    }
    await db.query("COMMIT");
    return decisionId;
  } catch (error: unknown) {
    await db.query("ROLLBACK");
    throw error;
  }
}

export async function decidePlacement(db: pg.ClientBase, decision: Decision): Promise<Decided> {
  if (decision.decidedBy.trim() === "" || decision.reason.trim() === "") {
    throw new PlacementRefused("A decision needs the reviewer's name and a reason.");
  }
  const tender = await findTender(db, decision);
  const district =
    decision.districtLgdCode === null
      ? null
      : await findDistrict(db, tender.stateLgdCode, decision.districtLgdCode);
  if (district === null && tender.placed) {
    // "Cannot be placed" is a finding about an unplaced tender. Unplacing one a
    // rule placed would erase that rule's evidence; record a district instead.
    throw new PlacementRefused("This tender is already placed; decide a district, or leave it.");
  }
  const decisionId = await record(db, tender.id, district, decision);
  return {
    decisionId,
    tenderId: Number(tender.id),
    adminUnitId: district === null ? null : Number(district.id),
    districtName: district?.name ?? null,
  };
}
