import type pg from "pg";
import { describe, expect, it } from "vitest";

import { aliasesOfState, readAliases, type DistrictAliasEntry } from "../src/gepnic/aliases";
import { districtKey } from "../src/gepnic/detail";

/**
 * An alias is a person's decision about what a name means. These checks keep
 * the file from becoming a list of guesses: an approved alias names who
 * approved it and when, a proposed one claims nobody's approval, and no name
 * is an alias twice in one state.
 */
const entries = readAliases();

describe("the alias file", () => {
  it("states evidence for every alias, and a state and district by LGD code", () => {
    for (const e of entries) {
      expect(e.evidence.trim(), e.alias).not.toBe("");
      expect(e.state_lgd_code, e.alias).toMatch(/^\d+$/u);
      expect(e.district_lgd_code, e.alias).toMatch(/^\d+$/u);
      // An alias that is the district's own name, as the ledger compares names,
      // is not an alias and would hide a matching fault.
      expect(districtKey(e.alias), e.alias).not.toBe(districtKey(e.district_name));
    }
  });

  it("records approval only with who approved it and when", () => {
    for (const e of entries) {
      expect(["proposed", "approved"], e.alias).toContain(e.status);
      if (e.status === "approved") {
        expect(e.reviewed_by?.trim() ?? "", e.alias).not.toBe("");
        expect(e.reviewed_on ?? "", e.alias).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      } else {
        expect(e.reviewed_by, e.alias).toBeNull();
        expect(e.reviewed_on, e.alias).toBeNull();
      }
    }
  });

  it("never gives one name two meanings in a state", () => {
    const keys = entries.map((e) => `${e.state_lgd_code}:${districtKey(e.alias)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("aliases in use", () => {
  const entry = (over: Partial<DistrictAliasEntry>): DistrictAliasEntry => ({
    state_lgd_code: "3",
    alias: "Muktsar",
    district_lgd_code: "39",
    district_name: "Sri Muktsar Sahib",
    evidence: "test",
    status: "approved",
    reviewed_by: "a reviewer",
    reviewed_on: "2026-09-29",
    ...over,
  });

  function db(rows: unknown[]): { client: pg.ClientBase; asked: unknown[][] } {
    const asked: unknown[][] = [];
    const client = {
      query: (_sql: string, values: unknown[]) => {
        asked.push(values);
        return Promise.resolve({ rows });
      },
    } as unknown as pg.ClientBase;
    return { client, asked };
  }

  it("uses only approved aliases of the state asked about, resolved to the ledger's unit", async () => {
    const { client, asked } = db([{ id: "77", lgd_code: "39", name_en: "Sri Muktsar Sahib" }]);
    const aliases = await aliasesOfState(client, "3", [
      entry({}),
      entry({
        alias: "Moga Town",
        district_lgd_code: "40",
        status: "proposed",
        reviewed_by: null,
        reviewed_on: null,
      }),
      entry({ state_lgd_code: "5", alias: "Pauri", district_lgd_code: "52" }),
    ]);
    expect(asked).toEqual([["3", ["39"]]]);
    expect([...aliases.entries()]).toEqual([
      [
        districtKey("Muktsar"),
        { adminUnitId: 77, alias: "Muktsar", districtName: "Sri Muktsar Sahib" },
      ],
    ]);
  });

  it("drops an alias whose district the ledger does not hold, and asks nothing when none is approved", async () => {
    const missing = db([]);
    expect((await aliasesOfState(missing.client, "3", [entry({})])).size).toBe(0);
    const none = db([]);
    expect((await aliasesOfState(none.client, "9", [entry({})])).size).toBe(0);
    expect(none.asked).toEqual([]);
  });
});
