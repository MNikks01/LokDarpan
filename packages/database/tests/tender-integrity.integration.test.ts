import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresTenderRepository } from "../src/tender.repository";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * The two claims a tender surface must never confuse, asserted against a real
 * Postgres because both are enforced by the database.
 *
 * First: holding no tenders for a state is not evidence that none were
 * advertised. Second: a tender that changed must still be able to say what it
 * said before. A fake would prove neither — the second is a trigger.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "tender integrity (integration)",
  { timeout: 30_000 },
  () => {
    let pool: pg.Pool | undefined;
    let repository: PostgresTenderRepository | undefined;

    // Two characters, because every single-character sha256 fixture is already
    // taken: "7".repeat(64) is osm-load's seed artefact, and admin_unit rows
    // point at it, so removing it here broke that suite's fixtures.
    const ARTIFACT = "7a".repeat(32);
    // Codes well outside the real LGD range, so nothing here can collide with
    // ingested data.
    const COLLECTED_STATE = "9930001";
    const FAILING_STATE = "9930002";
    const STALE_STATE = "9930003";
    const EMPTY_BUT_COLLECTED_STATE = "9930004";
    const NEVER_COLLECTED_STATE = "9930005";
    const PORTALS = ["zz-collected", "zz-failing", "zz-stale", "zz-empty"];
    let versionId = 0;
    let tenderId = 0;

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
      repository = new PostgresTenderRepository(pool);

      await pool.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1, 'test-integrity', 'https://example.invalid/t', now(), 1, 'test/i.html')
         ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT],
      );
      const version = await pool.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('tender integrity test') RETURNING id`,
      );
      versionId = Number(version.rows[0]?.id);

      const window = async (
        portal: string,
        state: string,
        lastSuccess: string | null,
        lastChecked: string | null,
      ): Promise<void> => {
        await pool?.query(
          `INSERT INTO tender_collection_window
             (portal_code, collecting_since, last_success_at, last_checked_at, state_lgd_code)
           VALUES ($1, DATE '2026-09-01', $2::timestamptz, $3::timestamptz, $4)
           ON CONFLICT (portal_code) DO UPDATE SET
             last_success_at = EXCLUDED.last_success_at,
             last_checked_at = EXCLUDED.last_checked_at,
             state_lgd_code = EXCLUDED.state_lgd_code`,
          [portal, lastSuccess, lastChecked, state],
        );
      };

      const now = new Date().toISOString();
      const longAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      await window("zz-collected", COLLECTED_STATE, now, now);
      // Attempted more recently than it last succeeded.
      await window("zz-failing", FAILING_STATE, longAgo, now);
      await window("zz-stale", STALE_STATE, longAgo, longAgo);
      // Collected successfully, and it genuinely holds nothing.
      await window("zz-empty", EMPTY_BUT_COLLECTED_STATE, now, now);

      const tender = await pool.query<{ id: string }>(
        `INSERT INTO tender (portal_code, portal_tender_id, tender_reference, title,
                             closing_at, first_seen_at, last_seen_at, source_sha256,
                             dataset_version_id, extraction_confidence, tender_value_paise)
         VALUES ('zz-collected', 'integrity-1', 'REF/9', 'Original title',
                 TIMESTAMPTZ '2026-09-18 12:00:00+05:30', now(), now(), $1, $2, 0.95, 100000)
         RETURNING id`,
        [ARTIFACT, versionId],
      );
      tenderId = Number(tender.rows[0]?.id);
    });

    afterAll(async () => {
      await pool?.query(`DELETE FROM tender WHERE portal_code = ANY($1)`, [PORTALS]);
      await pool?.query(`DELETE FROM tender_collection_window WHERE portal_code = ANY($1)`, [
        PORTALS,
      ]);
      await pool?.query(`DELETE FROM dataset_version WHERE id = $1`, [versionId]);
      await pool?.query(`DELETE FROM source_artifact WHERE sha256 = $1`, [ARTIFACT]);
      await pool?.end();
    });

    describe("holding nothing is not evidence that nothing exists", () => {
      // The failure this prevents: Maharashtra holds no tenders and the panel
      // said "0 tenders". True as a count, false as a statement — no Maharashtra
      // portal is collected, so the zero measures our reach.
      it("reports a state nobody collects as not_collected, not as empty", async () => {
        const collection = await repository?.collectionForState(NEVER_COLLECTED_STATE);
        expect(collection?.status).toBe("not_collected");
        expect(collection?.portalCode).toBeNull();
        expect(collection?.collectingSince).toBeNull();
      });

      // The other half of the same distinction, and the reason a count may not
      // stand in for either: this state IS collected and holds nothing.
      it("reports a collected state holding no tenders as collected", async () => {
        const collection = await repository?.collectionForState(EMPTY_BUT_COLLECTED_STATE);
        expect(collection?.status).toBe("collected");
      });

      it("distinguishes a failing collection from an old one", async () => {
        // Checked since it last succeeded: the attempts themselves are failing.
        const failing = await repository?.collectionForState(FAILING_STATE);
        expect(failing?.status).toBe("failing");

        // Not attempted since; the data is simply old.
        const stale = await repository?.collectionForState(STALE_STATE);
        expect(stale?.status).toBe("stale");
      });

      it("reports a recently collected state as collected", async () => {
        const collection = await repository?.collectionForState(COLLECTED_STATE);
        expect(collection?.status).toBe("collected");
        expect(collection?.portalCode).toBe("zz-collected");
      });

      it("keeps the three freshness timestamps apart", async () => {
        const windows = await repository?.collectionWindows();
        const failing = windows?.find((w) => w.portalCode === "zz-failing");
        expect(failing?.lastCheckedAt).not.toBeNull();
        expect(failing?.lastSuccessAt).not.toBeNull();
        // Checked later than it succeeded is the whole signal; conflating the
        // two would make a portal failing every hour look healthy.
        expect(new Date(failing?.lastCheckedAt ?? 0).getTime()).toBeGreaterThan(
          new Date(failing?.lastSuccessAt ?? 0).getTime(),
        );
        expect(failing?.stateLgdCode).toBe(FAILING_STATE);
      });
    });

    describe("a tender that changed can still say what it said before", () => {
      const versions = async (): Promise<number> => {
        const result = await pool?.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM tender_version WHERE tender_id = $1`,
          [tenderId],
        );
        return Number(result?.rows[0]?.count ?? "0");
      };

      it("writes no version when the same reading arrives again", async () => {
        const before = await versions();
        // What every run does to every tender it still sees.
        await pool?.query(
          `UPDATE tender SET last_seen_at = now(), dataset_version_id = dataset_version_id
            WHERE id = $1`,
          [tenderId],
        );
        expect(await versions()).toBe(before);
      });

      it("keeps the old closing date when the portal moves it", async () => {
        const before = await versions();
        await pool?.query(
          `UPDATE tender SET closing_at = TIMESTAMPTZ '2026-09-25 12:00:00+05:30',
                             last_seen_at = now() WHERE id = $1`,
          [tenderId],
        );
        expect(await versions()).toBe(before + 1);

        const kept = await pool?.query<{ closing_at: string }>(
          `SELECT closing_at FROM tender_version
            WHERE tender_id = $1 ORDER BY superseded_at DESC LIMIT 1`,
          [tenderId],
        );
        expect(new Date(kept?.rows[0]?.closing_at ?? 0).toISOString()).toBe(
          new Date("2026-09-18T12:00:00+05:30").toISOString(),
        );
      });

      it("writes no second version when the changed reading arrives again", async () => {
        const before = await versions();
        await pool?.query(
          `UPDATE tender SET closing_at = TIMESTAMPTZ '2026-09-25 12:00:00+05:30',
                             last_seen_at = now() WHERE id = $1`,
          [tenderId],
        );
        expect(await versions()).toBe(before);
      });

      it("keeps the old value when the estimate changes", async () => {
        const before = await versions();
        await pool?.query(`UPDATE tender SET tender_value_paise = 250000 WHERE id = $1`, [
          tenderId,
        ]);
        expect(await versions()).toBe(before + 1);

        const kept = await pool?.query<{ tender_value_paise: string }>(
          `SELECT tender_value_paise FROM tender_version
            WHERE tender_id = $1 ORDER BY superseded_at DESC LIMIT 1`,
          [tenderId],
        );
        // Paise, as a string. A version that rounded would be worse than none.
        expect(kept?.rows[0]?.tender_value_paise).toBe("100000.00");
      });

      it("leaves the tender row holding the current reading", async () => {
        const current = await pool?.query<{ closing_at: string; tender_value_paise: string }>(
          `SELECT closing_at, tender_value_paise FROM tender WHERE id = $1`,
          [tenderId],
        );
        expect(new Date(current?.rows[0]?.closing_at ?? 0).toISOString()).toBe(
          new Date("2026-09-25T12:00:00+05:30").toISOString(),
        );
        expect(current?.rows[0]?.tender_value_paise).toBe("250000.00");
      });

      it("keeps every superseded reading attributable to its own observation", async () => {
        const kept = await pool?.query<{ source_sha256: string; dataset_version_id: string }>(
          `SELECT source_sha256, dataset_version_id FROM tender_version WHERE tender_id = $1`,
          [tenderId],
        );
        expect(kept?.rowCount).toBeGreaterThan(0);
        for (const row of kept?.rows ?? []) {
          // A version that could not name the fetch it came from would be a
          // claim about a government office with no evidence behind it.
          expect(row.source_sha256).toBe(ARTIFACT);
          expect(Number(row.dataset_version_id)).toBe(versionId);
        }
      });

      // Our resolver improving is not the government saying something new.
      it("writes no version when only the placement changes", async () => {
        const before = await versions();
        await pool?.query(
          `UPDATE tender SET admin_unit_id = NULL, linkage_confidence = NULL,
                             district_source = NULL, last_seen_at = now() WHERE id = $1`,
          [tenderId],
        );
        expect(await versions()).toBe(before);
      });
    });

    /**
     * PostgreSQL keeps microseconds; a JavaScript `Date` keeps milliseconds.
     *
     * ADR-049 recorded this as a known limitation of the trigger: a caller that
     * read a closing date back and wrote it again unchanged would hand back
     * 12:00:00.123 where 12:00:00.123789 was stored, and the ledger would record
     * a government office moving a deadline it never touched.
     *
     * The obvious fix — declaring the column timestamptz(3) — is wrong, and one
     * of these tests is why: that cast ROUNDS .123789 to .124 while the driver
     * TRUNCATES it to .123, leaving the two unequal and the spurious version
     * intact.
     */
    describe("a timestamp that lost precision in transit has not changed", () => {
      const MICROSECONDS = "2026-11-04 09:30:00.123789+05:30";
      let preciseId = 0;

      const versionsOf = async (id: number): Promise<number> => {
        const result = await pool?.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM tender_version WHERE tender_id = $1`,
          [id],
        );
        return Number(result?.rows[0]?.count ?? "0");
      };

      const storedText = async (id: number): Promise<string> => {
        const result = await pool?.query<{ at: string }>(
          `SELECT closing_at::text AS at FROM tender WHERE id = $1`,
          [id],
        );
        return result?.rows[0]?.at ?? "";
      };

      beforeAll(async () => {
        const created = await pool?.query<{ id: string }>(
          `INSERT INTO tender (portal_code, portal_tender_id, tender_reference, title,
                               closing_at, bid_opening_at, first_seen_at, last_seen_at,
                               source_sha256, dataset_version_id, extraction_confidence)
           VALUES ('zz-collected', 'precision-1', 'REF/P', 'Precision',
                   TIMESTAMPTZ '${MICROSECONDS}', TIMESTAMPTZ '${MICROSECONDS}',
                   now(), now(), $1, $2, 0.95)
           RETURNING id`,
          [ARTIFACT, versionId],
        );
        preciseId = Number(created?.rows[0]?.id);
      });

      it("writes no version when a millisecond-truncated reading is written back", async () => {
        const before = await versionsOf(preciseId);
        // Exactly what a caller gets from the driver and hands straight back.
        const read = await pool?.query<{ closing_at: Date }>(
          `SELECT closing_at FROM tender WHERE id = $1`,
          [preciseId],
        );
        const asJsDate = read?.rows[0]?.closing_at;
        expect(asJsDate?.getMilliseconds()).toBe(123);

        await pool?.query(`UPDATE tender SET closing_at = $2, last_seen_at = now() WHERE id = $1`, [
          preciseId,
          asJsDate,
        ]);
        expect(await versionsOf(preciseId)).toBe(before);
      });

      it("keeps the microseconds the database was given", async () => {
        // A comparison that merely ignored the difference would have let the
        // round trip quietly shorten the stored value.
        expect(await storedText(preciseId)).toContain(".123789");
      });

      it("writes no version when the bid opening date makes the same round trip", async () => {
        const before = await versionsOf(preciseId);
        const read = await pool?.query<{ bid_opening_at: Date }>(
          `SELECT bid_opening_at FROM tender WHERE id = $1`,
          [preciseId],
        );
        await pool?.query(
          `UPDATE tender SET bid_opening_at = $2, last_seen_at = now() WHERE id = $1`,
          [preciseId, read?.rows[0]?.bid_opening_at],
        );
        expect(await versionsOf(preciseId)).toBe(before);
        const kept = await pool?.query<{ at: string }>(
          `SELECT bid_opening_at::text AS at FROM tender WHERE id = $1`,
          [preciseId],
        );
        expect(kept?.rows[0]?.at).toContain(".123789");
      });

      // The guard must not become so lenient that a real change slips through.
      it("still writes a version when the change is a whole millisecond", async () => {
        const before = await versionsOf(preciseId);
        await pool?.query(
          `UPDATE tender SET closing_at = TIMESTAMPTZ '2026-11-04 09:30:00.124789+05:30',
                             last_seen_at = now() WHERE id = $1`,
          [preciseId],
        );
        expect(await versionsOf(preciseId)).toBe(before + 1);
      });

      it("still writes a version when a timestamp is withdrawn altogether", async () => {
        const before = await versionsOf(preciseId);
        await pool?.query(
          `UPDATE tender SET closing_at = NULL, last_seen_at = now() WHERE id = $1`,
          [preciseId],
        );
        expect(await versionsOf(preciseId)).toBe(before + 1);
      });

      it("still writes a version when a timestamp first appears", async () => {
        const before = await versionsOf(preciseId);
        await pool?.query(
          `UPDATE tender SET closing_at = TIMESTAMPTZ '2026-12-01 10:00:00+05:30',
                             last_seen_at = now() WHERE id = $1`,
          [preciseId],
        );
        expect(await versionsOf(preciseId)).toBe(before + 1);
      });
    });
  },
);
