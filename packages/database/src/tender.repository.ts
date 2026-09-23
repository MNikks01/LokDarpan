import type { Queryable } from "./published-fact.repository";

/**
 * Tenders, as the explorer reads them.
 *
 * WHAT THIS RETURNS, AND THE CLAIM IT DOES NOT MAKE
 * A tender is an advertisement of intent to buy. It is not an award: no winner
 * and no awarded value is held, because that data is CAPTCHA-gated on every
 * portal tested. And the district is the district of the OFFICE THAT ISSUED the
 * tender, not the work site — a Chief Engineer's circle office tenders across
 * several districts. Every caller of `countsByDistrict` is showing "tenders
 * issued by offices in this district", and its copy must say so.
 */

export interface DistrictTenderCount {
  readonly adminUnitId: number;
  readonly districtName: string;
  readonly tenderCount: number;
  /** Distinct departments issuing here, so a reader can see the mix. */
  readonly departments: readonly string[];
}

export interface TenderSummary {
  readonly id: number;
  readonly title: string;
  readonly tenderReference: string;
  readonly department: string | null;
  readonly closingAt: string | null;
  readonly bidOpeningAt: string | null;
  readonly tenderCategory: string | null;
  readonly productCategory: string | null;
  readonly tenderType: string | null;
  readonly location: string | null;
  readonly pincode: string | null;
  /** Decimal rupees as a string, or null. Never a JSON number. */
  readonly tenderValueInr: string | null;
  readonly emdInr: string | null;
  readonly organisationChain: string | null;
  readonly districtName: string | null;
  readonly districtSource: string | null;
  readonly linkageConfidence: number | null;
  readonly firstSeenAt: string;
  readonly sourceUrl: string;
}

export interface CollectionWindow {
  readonly portalCode: string;
  readonly collectingSince: string;
  readonly lastSuccessAt: string | null;
  /** When collection was last attempted, successful or not. */
  readonly lastCheckedAt: string | null;
  /** LGD code of the state this portal publishes for; null until next collected. */
  readonly stateLgdCode: string | null;
}

/**
 * Whether tender data is collected for a state, which is not the same question
 * as how many tenders it has.
 *
 * `not_collected` is the one that matters. Maharashtra holds no tenders, and the
 * explorer reported that as "0 tenders" — a true count and a false statement,
 * because no Maharashtra portal is collected at all, so the zero describes our
 * reach and reads as the government's silence. A count may never be evidence of
 * absence; only this can say which kind of nothing is on screen.
 */
export type CollectionStatus =
  /** No portal is collected for this state. Says nothing about what exists. */
  | "not_collected"
  /** Collected, and the last attempt succeeded recently. */
  | "collected"
  /** Collected before, but not successfully for longer than expected. */
  | "stale"
  /** Attempted more recently than it last succeeded: the attempts are failing. */
  | "failing";

export interface StateCollection {
  readonly stateLgdCode: string;
  readonly status: CollectionStatus;
  /** Null when nothing is collected for this state. */
  readonly portalCode: string | null;
  readonly collectingSince: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastCheckedAt: string | null;
}

/**
 * How long a successful collection stays current.
 *
 * The GePNIC landing page is polled daily, so two days without a success is the
 * first interval that cannot be one missed run. Deliberately generous: calling
 * fresh data stale costs a reader nothing, and calling stale data fresh is the
 * failure this project exists to avoid.
 */
const STALE_AFTER_HOURS = 48;

/**
 * Only tenders still open are counted.
 *
 * A closing date in the past is a tender nobody can bid on, and shading a
 * district for it would overstate what is currently advertised. A tender with
 * no stated closing date is included: the portal published no deadline, which
 * is not the same as one having passed.
 */
const STILL_OPEN = `(t.closing_at IS NULL OR t.closing_at > now())`;

/**
 * Tenders read from a state's own portals, when a state is asked for.
 *
 * Only for what has no district to go by: a tender that names no district we
 * hold, or the list of departments advertising. `$n` is the state's LGD code,
 * or null for the whole country.
 */
const FROM_STATE_PORTAL = (n: number): string =>
  `($${String(n)}::text IS NULL OR t.portal_code IN (
      SELECT w.portal_code FROM tender_collection_window w WHERE w.state_lgd_code = $${String(n)}))`;

/** The row shape `listTenders` selects, named so the mapping needs no casts. */
interface TenderRow {
  readonly id: string;
  readonly title: string;
  readonly tender_reference: string;
  readonly department: string | null;
  readonly closing_at: string | null;
  readonly bid_opening_at: string | null;
  readonly tender_category: string | null;
  readonly product_category: string | null;
  readonly tender_type: string | null;
  readonly location: string | null;
  readonly pincode: string | null;
  readonly organisation_chain: string | null;
  readonly district_source: string | null;
  readonly linkage_confidence: string | null;
  readonly first_seen_at: string;
  readonly district_name: string | null;
  readonly tender_value_inr: string | null;
  readonly emd_inr: string | null;
  readonly source_url: string;
}

export class PostgresTenderRepository {
  /** A pool, or a client inside `readLedger`'s snapshot. */
  constructor(private readonly db: Queryable) {}

  /**
   * Open tenders per district, for shading the map.
   *
   * Districts with no tenders are absent rather than zero. The caller shades
   * what is returned and leaves the rest unshaded, which is the truthful
   * rendering: collection is forward-only, so "none advertised" and "we hold
   * none" are the same statement about our own coverage.
   *
   * With a state, only districts inside it. Without one, the panel under
   * Odisha said "12 open tenders across 6 districts" when all twelve were in
   * Madhya Pradesh, Uttarakhand, Jharkhand and Kerala: the country's number
   * stated as the state's. Placement decides, not the portal, because the
   * count is a claim about where the issuing offices are.
   */
  async countsByDistrict(
    department?: string,
    stateLgdCode?: string,
  ): Promise<readonly DistrictTenderCount[]> {
    const result = await this.db.query<{
      admin_unit_id: string;
      district_name: string;
      tender_count: string;
      departments: string[] | null;
    }>(
      `WITH RECURSIVE within_state AS (
         SELECT u.id FROM admin_unit u
          WHERE $2::text IS NOT NULL AND u.level = 'state' AND u.lgd_code = $2
         UNION ALL
         SELECT c.id FROM admin_unit c JOIN within_state w ON c.parent_id = w.id
       )
       SELECT t.admin_unit_id,
              d.name_en AS district_name,
              count(*)::text AS tender_count,
              array_agg(DISTINCT t.department) FILTER (WHERE t.department IS NOT NULL) AS departments
         FROM tender t
         JOIN admin_unit d ON d.id = t.admin_unit_id
        WHERE ${STILL_OPEN}
          AND ($1::text IS NULL OR t.department = $1)
          AND ($2::text IS NULL OR t.admin_unit_id IN (SELECT id FROM within_state))
        GROUP BY t.admin_unit_id, d.name_en
        ORDER BY count(*) DESC`,
      [department ?? null, stateLgdCode ?? null],
    );
    return result.rows.map((row) => ({
      adminUnitId: Number(row.admin_unit_id),
      districtName: row.district_name,
      tenderCount: Number(row.tender_count),
      departments: row.departments ?? [],
    }));
  }

  /** Every department currently advertising, with its open-tender count; a state's portals only when given one. */
  async departments(
    stateLgdCode?: string,
  ): Promise<readonly { readonly name: string; readonly tenderCount: number }[]> {
    const result = await this.db.query<{ department: string; tender_count: string }>(
      `SELECT t.department, count(*)::text AS tender_count
         FROM tender t
        WHERE ${STILL_OPEN} AND t.department IS NOT NULL AND ${FROM_STATE_PORTAL(1)}
        GROUP BY t.department
        ORDER BY count(*) DESC, t.department`,
      [stateLgdCode ?? null],
    );
    return result.rows.map((r) => ({ name: r.department, tenderCount: Number(r.tender_count) }));
  }

  /**
   * The tenders themselves, for a district or across the portal.
   *
   * `unplacedOnly` exists because a tender whose district could not be
   * established is still a real advertisement. It must stay reachable rather
   * than disappear because the map has nowhere to draw it.
   */
  async listTenders(options: {
    readonly adminUnitId?: number;
    readonly department?: string;
    readonly unplacedOnly?: boolean;
    /** A state's own portals only, by LGD code. What scopes the unplaced list under a state. */
    readonly stateLgdCode?: string;
    readonly limit?: number;
  }): Promise<readonly TenderSummary[]> {
    const result = await this.db.query<TenderRow>(
      `SELECT t.id::text AS id, t.title, t.tender_reference, t.department,
              t.closing_at, t.bid_opening_at, t.tender_category, t.product_category,
              t.tender_type, t.location, t.pincode, t.organisation_chain,
              t.district_source, t.linkage_confidence::text AS linkage_confidence,
              t.first_seen_at, d.name_en AS district_name,
              -- Paise to rupees as text. A JSON number would lose precision on a
              -- large figure silently, behind a correct-looking source link.
              --
              -- The cast back to numeric(20,2) is not cosmetic: Postgres gives
              -- division a far higher scale, so dividing without the cast sends
              -- 592000.000000000000 to the page.
              (t.tender_value_paise / 100)::numeric(20, 2)::text AS tender_value_inr,
              (t.emd_paise / 100)::numeric(20, 2)::text AS emd_inr,
              a.source_url
         FROM tender t
         LEFT JOIN admin_unit d ON d.id = t.admin_unit_id
         JOIN source_artifact a ON a.sha256 = t.source_sha256
        WHERE ${STILL_OPEN}
          AND ($1::bigint IS NULL OR t.admin_unit_id = $1)
          AND ($2::text IS NULL OR t.department = $2)
          AND ($3::boolean IS NOT TRUE OR t.admin_unit_id IS NULL)
          AND ${FROM_STATE_PORTAL(5)}
        ORDER BY t.closing_at NULLS LAST, t.title
        LIMIT $4`,
      [
        options.adminUnitId ?? null,
        options.department ?? null,
        options.unplacedOnly ?? false,
        Math.min(options.limit ?? 100, 200),
        options.stateLgdCode ?? null,
      ],
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      tenderReference: row.tender_reference,
      department: row.department,
      closingAt: row.closing_at,
      bidOpeningAt: row.bid_opening_at,
      tenderCategory: row.tender_category,
      productCategory: row.product_category,
      tenderType: row.tender_type,
      location: row.location,
      pincode: row.pincode,
      tenderValueInr: row.tender_value_inr,
      emdInr: row.emd_inr,
      organisationChain: row.organisation_chain,
      districtName: row.district_name,
      districtSource: row.district_source,
      linkageConfidence: row.linkage_confidence === null ? null : Number(row.linkage_confidence),
      firstSeenAt: row.first_seen_at,
      sourceUrl: row.source_url,
    }));
  }

  /**
   * How many open tenders match, without reading any of their details.
   *
   * What the explorer shows while tender details are withheld: a count is
   * LokDarpan's measurement, not material reproduced from a portal (ADR-056).
   */
  async countTenders(options: {
    readonly adminUnitId?: number;
    readonly department?: string;
    readonly unplacedOnly?: boolean;
    readonly stateLgdCode?: string;
  }): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM tender t
        WHERE ${STILL_OPEN}
          AND ($1::bigint IS NULL OR t.admin_unit_id = $1)
          AND ($2::text IS NULL OR t.department = $2)
          AND ($3::boolean IS NOT TRUE OR t.admin_unit_id IS NULL)
          AND ${FROM_STATE_PORTAL(4)}`,
      [
        options.adminUnitId ?? null,
        options.department ?? null,
        options.unplacedOnly ?? false,
        options.stateLgdCode ?? null,
      ],
    );
    return Number(result.rows[0]?.count ?? "0");
  }

  /**
   * When collection began for each portal.
   *
   * The floor on the data, and not optional. Collection is forward-only, so
   * without this a reader cannot tell "nothing was advertised" from "we were
   * not looking yet", and the second reads as the first.
   */
  async collectionWindows(): Promise<readonly CollectionWindow[]> {
    const result = await this.db.query<{
      portal_code: string;
      collecting_since: string;
      last_success_at: string | null;
      last_checked_at: string | null;
      state_lgd_code: string | null;
    }>(
      `SELECT portal_code, collecting_since::text AS collecting_since, last_success_at,
              last_checked_at, state_lgd_code
         FROM tender_collection_window ORDER BY portal_code`,
    );
    return result.rows.map((r) => ({
      portalCode: r.portal_code,
      collectingSince: r.collecting_since,
      lastSuccessAt: r.last_success_at,
      lastCheckedAt: r.last_checked_at,
      stateLgdCode: r.state_lgd_code,
    }));
  }

  /**
   * Whether a state's tenders are collected at all, and how that is going.
   *
   * Derived from what the window rows say rather than stored as a flag. A state
   * is `not_collected` because nothing claims to collect it — not because
   * somebody remembered to set a column, which is a claim that can go stale on
   * its own.
   */
  async collectionForState(stateLgdCode: string): Promise<StateCollection> {
    const result = await this.db.query<{
      portal_code: string;
      collecting_since: string;
      last_success_at: string | null;
      last_checked_at: string | null;
      stale: boolean;
    }>(
      `SELECT portal_code, collecting_since::text AS collecting_since,
              last_success_at, last_checked_at,
              (last_success_at IS NULL
                 OR last_success_at < now() - ($2 || ' hours')::interval) AS stale
         FROM tender_collection_window
        WHERE state_lgd_code = $1
        ORDER BY last_success_at DESC NULLS LAST
        LIMIT 1`,
      [stateLgdCode, String(STALE_AFTER_HOURS)],
    );

    const row = result.rows[0];
    if (row === undefined) {
      return {
        stateLgdCode,
        status: "not_collected",
        portalCode: null,
        collectingSince: null,
        lastSuccessAt: null,
        lastCheckedAt: null,
      };
    }

    // Checked later than it last succeeded means the most recent attempt did
    // not complete. That is a different thing from old data, and it is the one
    // an operator has to act on.
    const attemptedSinceSuccess =
      row.last_checked_at !== null &&
      (row.last_success_at === null ||
        new Date(row.last_checked_at) > new Date(row.last_success_at));

    return {
      stateLgdCode,
      status: attemptedSinceSuccess ? "failing" : row.stale ? "stale" : "collected",
      portalCode: row.portal_code,
      collectingSince: row.collecting_since,
      lastSuccessAt: row.last_success_at,
      lastCheckedAt: row.last_checked_at,
    };
  }

  /**
   * How many open tenders we hold but could not place. Shown, never hidden.
   *
   * With a state, those read from its own portals: an unplaced tender has no
   * district, so the portal it was advertised on is the only tie it has to one.
   */
  async unplacedCount(stateLgdCode?: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM tender t
        WHERE ${STILL_OPEN} AND t.admin_unit_id IS NULL AND ${FROM_STATE_PORTAL(1)}`,
      [stateLgdCode ?? null],
    );
    return Number(result.rows[0]?.count ?? "0");
  }
}
