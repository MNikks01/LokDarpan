import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import {
  loadStates,
  openDatasetVersion,
  recordArtifact,
  sealDatasetVersion,
} from "../src/lgd/load.js";
import type { LgdState } from "../src/lgd/parse.js";
import type { RawArtifact } from "../src/raw-store.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

const artifact = (sha: string): RawArtifact => ({
  sha256: sha,
  sourceId: "lgd",
  sourceUrl: "https://lgdirectory.gov.in/globalviewstateforcitizen.do",
  retrievedAt: new Date("2026-08-25T00:00:00Z"),
  httpStatus: 200,
  contentType: "text/html;charset=UTF-8",
  byteSize: 42,
  storagePath: `lgd/${sha.slice(0, 2)}/${sha.slice(2, 4)}/${sha}`,
});

const state = (over: Partial<LgdState> = {}): LgdState => ({
  lgdCode: "99",
  nameEn: "Testland",
  nameLocal: null,
  isUnionTerritory: false,
  census2001Code: null,
  census2011Code: null,
  ...over,
});

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "loadStates (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };

    beforeAll(async () => {
      const c = new pg.Client({ connectionString: DATABASE_URL });
      await c.connect();
      await ensureMigrationTable(c);
      for (const m of pendingMigrations(
        await loadMigrations(MIGRATIONS_DIR),
        await readApplied(c),
      )) {
        await applyMigration(c, m);
      }
      client = c;
    }, 60_000);

    // Every test runs inside a transaction that is rolled back. Integration
    // tests share a developer's database; rows left behind would mix dataset
    // versions into real data and make the API refuse to serve it.
    beforeEach(async () => {
      await db().query("BEGIN");
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    afterAll(async () => {
      await client?.end();
    });

    async function fixture(): Promise<{ sha: string; versionId: number }> {
      const sha = Array.from(
        { length: 64 },
        () => "0123456789abcdef"[Math.floor(Math.random() * 16)],
      ).join("");
      await recordArtifact(db(), artifact(sha));
      const versionId = await openDatasetVersion(db(), `test ${sha.slice(0, 8)}`);
      return { sha, versionId };
    }

    it("records the artefact before any fact cites it", async () => {
      const { sha } = await fixture();
      const r = await db().query(`SELECT byte_size FROM source_artifact WHERE sha256 = $1`, [sha]);
      expect(r.rows).toHaveLength(1);
    });

    it("recording the same artefact twice is not an error", async () => {
      const { sha } = await fixture();
      await expect(recordArtifact(db(), artifact(sha))).resolves.toBeUndefined();
    });

    it("inserts new states and reports the count", async () => {
      const { sha, versionId } = await fixture();
      const code = `T${String(Date.now()).slice(-6)}`;
      const result = await loadStates(db(), [state({ lgdCode: code })], {
        artifact: artifact(sha),
        datasetVersionId: versionId,
        validFrom: "2026-08-25",
      });
      expect(result).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
    });

    // Re-running an ingest must converge, not duplicate or churn provenance.
    it("is idempotent: an unchanged state is neither inserted nor updated", async () => {
      const { sha, versionId } = await fixture();
      const code = `T${String(Date.now()).slice(-6)}I`;
      const ctx = { artifact: artifact(sha), datasetVersionId: versionId, validFrom: "2026-08-25" };
      await loadStates(db(), [state({ lgdCode: code })], ctx);
      const second = await loadStates(db(), [state({ lgdCode: code })], ctx);
      expect(second).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
    });

    it("updates a renamed state and repoints its provenance", async () => {
      const first = await fixture();
      const code = `T${String(Date.now()).slice(-6)}U`;
      await loadStates(db(), [state({ lgdCode: code, nameEn: "Old Name" })], {
        artifact: artifact(first.sha),
        datasetVersionId: first.versionId,
        validFrom: "2026-08-25",
      });

      const second = await fixture();
      const result = await loadStates(db(), [state({ lgdCode: code, nameEn: "New Name" })], {
        artifact: artifact(second.sha),
        datasetVersionId: second.versionId,
        validFrom: "2026-08-25",
      });

      expect(result).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
      const r = await db().query(
        `SELECT name_en, source_sha256 FROM admin_unit WHERE lgd_code = $1 AND level = 'state'`,
        [code],
      );
      expect(r.rows[0]).toMatchObject({ name_en: "New Name", source_sha256: second.sha });
    });

    it("stores a genuine local name and a null one faithfully", async () => {
      const { sha, versionId } = await fixture();
      const ctx = { artifact: artifact(sha), datasetVersionId: versionId, validFrom: "2026-08-25" };
      const withLocal = `T${String(Date.now()).slice(-6)}L`;
      const without = `T${String(Date.now()).slice(-6)}N`;
      await loadStates(
        db(),
        [
          state({ lgdCode: withLocal, nameEn: "Maharashtra", nameLocal: "महाराष्ट्र" }),
          state({ lgdCode: without, nameEn: "Assam", nameLocal: null }),
        ],
        ctx,
      );
      const r = await db().query(
        `SELECT lgd_code, name_local FROM admin_unit WHERE lgd_code = ANY($1) ORDER BY lgd_code`,
        [[withLocal, without]],
      );
      const byCode = new Map(r.rows.map((x) => [(x as { lgd_code: string }).lgd_code, x]));
      expect(byCode.get(withLocal)).toMatchObject({ name_local: "महाराष्ट्र" });
      expect(byCode.get(without)).toMatchObject({ name_local: null });
    });

    it("seals a dataset version", async () => {
      const { versionId } = await fixture();
      await sealDatasetVersion(db(), versionId);
      const r = await db().query(`SELECT sealed_at FROM dataset_version WHERE id = $1`, [
        versionId,
      ]);
      expect((r.rows[0] as { sealed_at: Date | null }).sealed_at).not.toBeNull();
    });
  },
);
