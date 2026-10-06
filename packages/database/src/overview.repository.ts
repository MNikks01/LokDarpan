import { displayTitle, mayRepublish } from "@lokdarpan/domain";

import { toRupees, type Queryable } from "./published-fact.repository";

/**
 * What the ledger holds, counted, for the homepage.
 *
 * Every number the homepage states comes from here, read in one snapshot, so a
 * reader is never shown a count someone typed into a component and forgot to
 * update. The counts are of our own holdings: "30 audit reports" says what
 * LokDarpan has read, never what the government has published.
 *
 * Nothing here ranks. Per-state figures are returned in LGD-code order and
 * only for states that hold something, because the homepage marks where records
 * are and does not order places against each other
 * (`.docs/17-legal/legal-ethical-rules.md`).
 */

export interface StateHoldings {
  readonly stateLgdCode: string;
  readonly stateName: string;
  readonly reports: number;
  readonly publishedFacts: number;
}

export interface DistrictOpenTenders {
  readonly stateLgdCode: string;
  readonly districtLgdCode: string;
  readonly openTenders: number;
}

/**
 * One verified figure, with everything needed to cite it.
 *
 * The homepage uses it to show what a source trail looks like, so it is chosen
 * by a fixed rule rather than by hand: the first verified amount, in document
 * and page order, whose sentence the parser read whole. A fixed rule means the
 * example cannot be picked for effect.
 */
export interface ExampleFigure {
  readonly documentId: number;
  readonly documentTitle: string;
  readonly issuingAuthority: string;
  readonly stateName: string | null;
  readonly pageNumber: number;
  readonly rawText: string;
  /** Rupees, as a decimal string, converted from paise the way every published figure is. */
  readonly value: string;
  readonly verifiedAt: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
}

export interface LedgerOverview {
  readonly states: number;
  readonly districts: number;
  /** Units below district level — sub-districts, local bodies, villages — held so far. */
  readonly belowDistrict: number;
  readonly reports: number;
  readonly reportPages: number;
  readonly publishedFacts: number;
  readonly openTenders: number;
  /** Open tenders placed in a district; the rest are held but unplaced. */
  readonly placedOpenTenders: number;
  /** Portals collected from at least once. */
  readonly tenderPortals: number;
  /**
   * States whose portal has been collected from, in LGD-code order. A state
   * absent here is "not collected", which a reader must never see as zero.
   */
  readonly tenderStates: readonly string[];
  readonly holdingsByState: readonly StateHoldings[];
  readonly openTendersByDistrict: readonly DistrictOpenTenders[];
  readonly example: ExampleFigure | null;
}

/** The same rule as the tender repository's: a passed deadline is not open. */
const STILL_OPEN = `(t.closing_at IS NULL OR t.closing_at > now())`;

export class PostgresOverviewRepository {
  /** A pool, or a client inside `readLedger`'s snapshot. */
  constructor(private readonly db: Queryable) {}

  async overview(): Promise<LedgerOverview> {
    // Sequential, not Promise.all: inside `readLedger` this is one client, and
    // pg queues concurrent queries on a client anyway.
    const totals = await this.totals();
    const holdingsByState = await this.holdingsByState();
    const openTendersByDistrict = await this.openTendersByDistrict();
    const tenderStates = await this.tenderStates();
    const example = await this.example();
    return { ...totals, tenderStates, holdingsByState, openTendersByDistrict, example };
  }

  private async totals(): Promise<
    Omit<LedgerOverview, "tenderStates" | "holdingsByState" | "openTendersByDistrict" | "example">
  > {
    // Counts cross as text: pg returns a bigint as a string, converted once here.
    const result = await this.db.query<Record<string, string>>(
      `SELECT
         (SELECT count(*) FROM admin_unit WHERE level = 'state')::text     AS states,
         (SELECT count(*) FROM admin_unit WHERE level = 'district')::text  AS districts,
         (SELECT count(*) FROM admin_unit
           WHERE level NOT IN ('country', 'state', 'district'))::text      AS below_district,
         (SELECT count(*) FROM document)::text                             AS reports,
         (SELECT count(*) FROM document_page)::text                        AS report_pages,
         (SELECT count(*) FROM published_fact)::text                       AS published_facts,
         (SELECT count(*) FROM tender t WHERE ${STILL_OPEN})::text         AS open_tenders,
         (SELECT count(*) FROM tender t
           WHERE ${STILL_OPEN} AND t.admin_unit_id IS NOT NULL)::text      AS placed_open_tenders,
         (SELECT count(*) FROM tender_collection_window
           WHERE last_success_at IS NOT NULL)::text                        AS tender_portals`,
    );
    const row = result.rows[0] ?? {};
    const n = (key: string): number => Number(row[key] ?? "0");
    return {
      states: n("states"),
      districts: n("districts"),
      belowDistrict: n("below_district"),
      reports: n("reports"),
      reportPages: n("report_pages"),
      publishedFacts: n("published_facts"),
      openTenders: n("open_tenders"),
      placedOpenTenders: n("placed_open_tenders"),
      tenderPortals: n("tender_portals"),
    };
  }

  private async tenderStates(): Promise<readonly string[]> {
    const result = await this.db.query<{ state_lgd_code: string }>(
      `SELECT state_lgd_code FROM tender_collection_window
        WHERE last_success_at IS NOT NULL AND state_lgd_code IS NOT NULL
        GROUP BY state_lgd_code
        ORDER BY length(state_lgd_code), state_lgd_code`,
    );
    return result.rows.map((r) => r.state_lgd_code);
  }

  /** States with at least one report filed against them, in LGD-code order. */
  private async holdingsByState(): Promise<readonly StateHoldings[]> {
    const result = await this.db.query<{
      lgd_code: string;
      name_en: string;
      reports: string;
      published_facts: string;
    }>(
      `SELECT u.lgd_code, u.name_en,
              count(*)::text AS reports,
              (SELECT count(*) FROM published_fact p
                 JOIN document pd ON pd.id = p.document_id
                WHERE pd.admin_unit_id = u.id)::text AS published_facts
         FROM document d
         JOIN admin_unit u ON u.id = d.admin_unit_id AND u.level = 'state'
        GROUP BY u.id, u.lgd_code, u.name_en
        ORDER BY length(u.lgd_code), u.lgd_code`,
    );
    return result.rows.map((r) => ({
      stateLgdCode: r.lgd_code,
      stateName: r.name_en,
      reports: Number(r.reports),
      publishedFacts: Number(r.published_facts),
    }));
  }

  /** Districts with open tenders placed in them, keyed as the boundary manifest keys them. */
  private async openTendersByDistrict(): Promise<readonly DistrictOpenTenders[]> {
    const result = await this.db.query<{
      state_lgd_code: string;
      district_lgd_code: string;
      open_tenders: string;
    }>(
      `SELECT s.lgd_code AS state_lgd_code, d.lgd_code AS district_lgd_code,
              count(*)::text AS open_tenders
         FROM tender t
         JOIN admin_unit d ON d.id = t.admin_unit_id AND d.level = 'district'
         JOIN admin_unit s ON s.id = d.parent_id AND s.level = 'state'
        WHERE ${STILL_OPEN}
        GROUP BY s.lgd_code, d.lgd_code
        ORDER BY length(s.lgd_code), s.lgd_code, length(d.lgd_code), d.lgd_code`,
    );
    return result.rows.map((r) => ({
      stateLgdCode: r.state_lgd_code,
      districtLgdCode: r.district_lgd_code,
      openTenders: Number(r.open_tenders),
    }));
  }

  /**
   * The example figure, chosen by rules that are written down rather than by
   * taste, each of which keeps the example from saying more than it shows:
   *
   * - a whole sentence: one the parser clipped starts or ends with an ellipsis,
   *   and an excerpt reads as selective quotation;
   * - exactly one rupee amount, so which number is "the figure" is not in doubt;
   * - no rate, so it never needs a denominator explained;
   * - printable English: a sentence whose rupee sign the PDF's font turned into
   *   another character is faithful to the file but unreadable out of context;
   * - about receipts, expenditure or a budget. Descriptive, not an audit
   *   observation about a shortfall: shown on its own on a homepage, the second
   *   kind would read as an accusation (`legal-ethical-rules.md`).
   */
  private async example(): Promise<ExampleFigure | null> {
    const result = await this.db.query<{
      document_id: string;
      document_title: string;
      issuing_authority: string;
      source_id: string;
      state_name: string | null;
      page_number: number;
      raw_text: string;
      value: string;
      verified_at: Date | string;
      source_url: string;
      retrieved_at: Date | string;
    }>(
      `SELECT p.document_id, p.document_title, d.issuing_authority, s.source_id,
              u.name_en AS state_name, p.page_number, p.raw_text, p.value,
              p.verified_at, p.source_url, p.retrieved_at
         FROM published_fact p
         JOIN document d ON d.id = p.document_id
         JOIN source_artifact s ON s.sha256 = d.source_sha256
         LEFT JOIN admin_unit u ON u.id = d.admin_unit_id
        WHERE p.kind = 'monetary_amount'
          AND p.value IS NOT NULL
          AND p.per_unit IS NULL
          AND p.raw_text NOT LIKE '…%'
          AND p.raw_text NOT LIKE '%…'
          AND p.raw_text ~ '^[^₹]*₹[^₹]*$'
          AND p.raw_text ~ '^[ -~₹‘’“”–—]+$'
          AND p.raw_text ~* '(revenue receipts|total expenditure|budget)'
          AND length(p.raw_text) BETWEEN 60 AND 240
        ORDER BY d.title, p.page_number, p.id
        LIMIT 50`,
    );
    // The same two gates every document page applies: a source whose publisher
    // has not permitted republication is withheld, and a value that is not
    // clean paise is not shown.
    for (const r of result.rows) {
      if (!mayRepublish(r.source_id)) continue;
      const value = toRupees(r.value);
      if (value === null) continue;
      return {
        documentId: Number(r.document_id),
        documentTitle: displayTitle(r.document_title),
        issuingAuthority: r.issuing_authority,
        stateName: r.state_name,
        pageNumber: r.page_number,
        rawText: r.raw_text,
        value,
        verifiedAt: new Date(r.verified_at).toISOString(),
        sourceUrl: r.source_url,
        retrievedAt: new Date(r.retrieved_at).toISOString(),
      };
    }
    return null;
  }
}
