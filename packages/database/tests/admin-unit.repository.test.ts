import { AppError } from "@lokdarpan/errors";
import { describe, expect, it } from "vitest";

import { PostgresAdminUnitRepository } from "../src/admin-unit.repository";
import type { Queryable } from "../src/published-fact.repository";

const ROW = {
  id: "20",
  lgd_code: "33",
  level: "state",
  name_en: "Tamil Nadu",
  name_local: "தமிழ்நாடு",
  parent_id: null,
  source_sha256: "a".repeat(64),
  source_url: "https://lgdirectory.gov.in/",
  retrieved_at: new Date("2026-08-25T06:00:00.000Z"),
  extraction_confidence: "1.00",
  dataset_version_id: "412",
};

/** A snapshot client that answers every statement with the given rows. */
function snapshot(rows: unknown[]): { db: Queryable; sql: string[]; values: unknown[][] } {
  const sql: string[] = [];
  const values: unknown[][] = [];
  const db = {
    query: (text: string, params: unknown[] = []) => {
      sql.push(text);
      values.push(params);
      return Promise.resolve({ rows, rowCount: rows.length });
    },
  } as unknown as Queryable;
  return { db, sql, values };
}

describe("PostgresAdminUnitRepository", () => {
  it("returns a unit with the provenance of the record it was read from", async () => {
    const { db } = snapshot([ROW]);
    const unit = await new PostgresAdminUnitRepository({ db }).findById(20);
    expect(unit).toEqual({
      id: 20,
      lgdCode: "33",
      level: "state",
      nameEn: "Tamil Nadu",
      nameLocal: "தமிழ்நாடு",
      parentId: null,
      provenance: {
        sourceSha256: "a".repeat(64),
        sourceUrl: "https://lgdirectory.gov.in/",
        retrievedAt: "2026-08-25T06:00:00.000Z",
        extractionConfidence: 1,
        datasetVersion: 412,
      },
    });
  });

  it("reports a unit that does not exist as not found, and tells the caller", async () => {
    const { db } = snapshot([]);
    const missed: number[] = [];
    const repository = new PostgresAdminUnitRepository({
      db,
      onNotFound: (id) => missed.push(id),
    });
    const failure = await repository.findById(999).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).status).toBe(404);
    expect(missed).toEqual([999]);
  });

  it("lists by level and by parent, keeping a child's parent", async () => {
    const child = { ...ROW, id: "21", level: "district", name_en: "Chennai", parent_id: "20" };
    const { db, sql, values } = snapshot([child]);
    const repository = new PostgresAdminUnitRepository({ db });

    expect((await repository.listByLevel("district"))[0]?.parentId).toBe(20);
    expect(sql[0]).toContain("WHERE a.level = $1");
    expect(values[0]).toEqual(["district"]);

    expect((await repository.listChildren(20)).map((u) => u.nameEn)).toEqual(["Chennai"]);
    expect(sql[1]).toContain("WHERE a.parent_id = $1");
    expect(values[1]).toEqual([20]);
  });

  it("refuses to serve from credentials that can write to the ledger", async () => {
    await expect(
      new PostgresAdminUnitRepository({ db: snapshot([{ writable: true }]).db }).assertReadOnly(),
    ).rejects.toThrow(/can write to the ledger/);
    await expect(
      new PostgresAdminUnitRepository({ db: snapshot([{ writable: false }]).db }).assertReadOnly(),
    ).resolves.toBeUndefined();
  });

  it("leaves a caller's snapshot open, and closes a pool it opened itself", async () => {
    // A pool connects lazily, so opening and closing one needs no database.
    for (const runtime of ["server", "serverless"] as const) {
      const owned = new PostgresAdminUnitRepository({
        connectionString: "postgresql://nobody@127.0.0.1:1/none",
        runtime,
      });
      await expect(owned.close()).resolves.toBeUndefined();
    }
    await expect(new PostgresAdminUnitRepository({ db: snapshot([]).db }).close()).resolves.toBe(
      undefined,
    );
  });
});
