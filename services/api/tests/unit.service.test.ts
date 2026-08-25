import "reflect-metadata";
import { describe, expect, it } from "vitest";

import { MetricsRegistry } from "@lokdarpan/observability";

import { AppError } from "../src/errors/index.js";
import type {
  AdminUnit,
  AdminUnitLevel,
  AdminUnitRepository,
} from "../src/modules/units/unit.repository.js";
import {
  UnitService,
  parseLevel,
  singleDatasetVersion,
} from "../src/modules/units/unit.service.js";

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

describe("singleDatasetVersion", () => {
  it("returns the version when every fact shares one", () => {
    expect(singleDatasetVersion([unit(1, 101), unit(2, 101)])).toBe(101);
  });

  // Two figures on one page carrying different provenance vintages, while
  // appearing equally current, is a traceability defect — refused, not served.
  it("refuses a payload that mixes dataset versions", () => {
    expect(() => singleDatasetVersion([unit(1, 101), unit(2, 102)])).toThrow(AppError);
    expect(() => singleDatasetVersion([unit(1, 101), unit(2, 102)])).toThrow(
      /single dataset version/i,
    );
  });

  it("keeps the mixed versions out of the client-facing message", () => {
    try {
      singleDatasetVersion([unit(1, 101), unit(2, 102)]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).publicMessage).not.toMatch(/10[12]/);
      expect((error as AppError).status).toBe(500);
    }
  });

  it("refuses an empty payload rather than inventing a version", () => {
    expect(() => singleDatasetVersion([])).toThrow(AppError);
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

  it("returns a unit with its children and one dataset version", async () => {
    const service = new UnitService(
      new FakeRepo(new Map([[20, mh]]), [unit(21, 101)]),
      new MetricsRegistry(),
    );
    const view = await service.getUnit("20");
    expect(view.unit.nameEn).toBe("Maharashtra");
    expect(view.unit.nameLocal).toBe("महाराष्ट्र");
    expect(view.children).toHaveLength(1);
    expect(view.datasetVersion).toBe(101);
  });

  it("refuses a unit whose children came from another ingest", async () => {
    const service = new UnitService(
      new FakeRepo(new Map([[20, mh]]), [unit(21, 999)]),
      new MetricsRegistry(),
    );
    await expect(service.getUnit("20")).rejects.toThrow(/single dataset version/i);
  });

  // The refusal is also an integrity alarm: it must be visible on /metrics,
  // not only in a stack trace nobody is watching.
  it("raises a contract-violation alarm when versions are mixed", async () => {
    const metrics = new MetricsRegistry();
    const service = new UnitService(new FakeRepo(new Map([[20, mh]]), [unit(21, 999)]), metrics);
    await expect(service.getUnit("20")).rejects.toThrow();
    expect(metrics.render()).toContain(
      'lokdarpan_contract_violation_total{kind="mixed_dataset_version"} 1',
    );
  });

  it("raises no alarm when the payload is consistent", async () => {
    const metrics = new MetricsRegistry();
    const service = new UnitService(new FakeRepo(new Map([[20, mh]]), [unit(21, 101)]), metrics);
    await service.getUnit("20");
    expect(metrics.render()).not.toContain("contract_violation");
  });

  it("rejects a non-numeric id before touching the database", async () => {
    const service = new UnitService(new FakeRepo(new Map()), new MetricsRegistry());
    await expect(service.getUnit("../../etc/passwd")).rejects.toThrow(/positive integer/i);
    await expect(service.getUnit("-1")).rejects.toThrow(/positive integer/i);
  });

  it("propagates not-found", async () => {
    const service = new UnitService(new FakeRepo(new Map()), new MetricsRegistry());
    await expect(service.getUnit("404")).rejects.toThrow(AppError);
  });

  it("lists by level with a single dataset version", async () => {
    const service = new UnitService(new FakeRepo(new Map([[20, mh]])), new MetricsRegistry());
    const result = await service.listByLevel("state");
    expect(result.units).toHaveLength(1);
    expect(result.datasetVersion).toBe(101);
  });
});
