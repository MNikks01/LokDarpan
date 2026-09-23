import { describe, expect, it } from "vitest";

import { AppError } from "@lokdarpan/errors";
import type { AdminUnit, AdminUnitLevel, AdminUnitRepository } from "../src/admin-unit";
import { UnitService, newestDatasetVersion, parseLevel } from "../src/unit.service";

const unit = (id: number, datasetVersion: number, over: Partial<AdminUnit> = {}): AdminUnit => ({
  id,
  lgdCode: String(id),
  level: "state",
  nameEn: `Unit ${String(id)}`,
  nameLocal: null,
  parentId: null,
  provenance: {
    sourceSha256: "a".repeat(64),
    sourceUrl: "https://lgdirectory.gov.in/globalviewstateforcitizen.do",
    retrievedAt: "2026-08-25T00:00:00.000Z",
    extractionConfidence: 1,
    datasetVersion,
  },
  ...over,
});

class FakeRepo implements AdminUnitRepository {
  constructor(
    private readonly byId: ReadonlyMap<number, AdminUnit>,
    private readonly children: readonly AdminUnit[] = [],
  ) {}
  findById(id: number): Promise<AdminUnit> {
    const found = this.byId.get(id);
    if (found === undefined) return Promise.reject(AppError.notFound("This administrative unit"));
    return Promise.resolve(found);
  }
  listByLevel(_level: AdminUnitLevel): Promise<AdminUnit[]> {
    return Promise.resolve([...this.byId.values()]);
  }
  listChildren(_parentId: number): Promise<AdminUnit[]> {
    return Promise.resolve([...this.children]);
  }
}

describe("newestDatasetVersion", () => {
  it("names the newest load in the payload, so it never claims an older vintage", () => {
    expect(newestDatasetVersion([unit(1, 101), unit(2, 104), unit(3, 102)])).toBe(104);
  });

  it("is 0 for an empty payload, as an empty ledger is", () => {
    expect(newestDatasetVersion([])).toBe(0);
  });
});

describe("parseLevel", () => {
  it("accepts every level the schema defines", () => {
    for (const level of [
      "country",
      "state",
      "district",
      "sub_district",
      "block",
      "village",
      "urban_local_body",
      "ward",
      "gram_panchayat",
    ]) {
      expect(parseLevel(level)).toBe(level);
    }
  });

  it("rejects an unknown level", () => {
    expect(() => parseLevel("galaxy")).toThrow(/Unknown administrative level/i);
    expect(() => parseLevel("STATE")).toThrow();
  });
});

describe("UnitService", () => {
  const mh = unit(20, 101, { nameEn: "Maharashtra", nameLocal: "महाराष्ट्र", lgdCode: "27" });

  it("returns a unit with its children", async () => {
    const service = new UnitService(new FakeRepo(new Map([[20, mh]]), [unit(21, 101)]));
    const view = await service.getUnit("20");
    expect(view.unit.nameEn).toBe("Maharashtra");
    expect(view.unit.nameLocal).toBe("महाराष्ट्र");
    expect(view.children).toHaveLength(1);
  });

  // The rule this replaces refused exactly this, and geography is loaded
  // district by district, so it refused every real state (ADR-053).
  it("serves units from several loads, each keeping the version it came from", async () => {
    const service = new UnitService(new FakeRepo(new Map([[20, mh]]), [unit(21, 999)]));
    const view = await service.getUnit("20");
    expect(view.unit.provenance.datasetVersion).toBe(101);
    expect(view.children[0]?.provenance.datasetVersion).toBe(999);
  });

  it("rejects a non-numeric id before touching the database", async () => {
    const service = new UnitService(new FakeRepo(new Map()));
    await expect(service.getUnit("../../etc/passwd")).rejects.toThrow(/positive integer/i);
    await expect(service.getUnit("-1")).rejects.toThrow(/positive integer/i);
  });

  it("propagates not-found", async () => {
    const service = new UnitService(new FakeRepo(new Map()));
    await expect(service.getUnit("404")).rejects.toThrow(AppError);
  });

  it("lists by level, however many loads the units came from", async () => {
    const service = new UnitService(
      new FakeRepo(
        new Map([
          [20, mh],
          [32, unit(32, 140)],
        ]),
      ),
    );
    const result = await service.listByLevel("state");
    expect(result.units.map((u) => u.provenance.datasetVersion)).toEqual([101, 140]);
  });
});
