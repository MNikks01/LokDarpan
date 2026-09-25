import { describe, expect, it } from "vitest";

import type { Http } from "../src/net/fetch-with-limits";
import type pg from "pg";

import { readDirectoryFromApi } from "../src/pincode/api";
import { replaceDirectory } from "../src/pincode/load";
import { csvRows, parseApiRecords, parseDirectory } from "../src/pincode/parse";

/** Synthetic rows in the current edition's column order (catalogue, 2026-09-25). */
const CSV = [
  "circlename,regionname,divisionname,officename,pincode,officetype,delivery,district,statename,latitude,longitude",
  "Tamilnadu Circle,Chennai Region,Villupuram Division,Manampoondi B.O,605602,BO,Delivery,VILLUPURAM,TAMIL NADU,11.9,79.4",
  '"Tamilnadu Circle","Chennai Region","Villupuram, Division","Mugaiyur ""S"" O",605602,SO,Delivery,VILLUPURAM,TAMIL NADU,NA,NA',
  "x,y,z,Nowhere B.O,000000,BO,Delivery,VILLUPURAM,TAMIL NADU,NA,NA",
  "x,y,z,Blank B.O,605603,BO,Delivery,NA,TAMIL NADU,NA,NA",
].join("\r\n");

describe("the directory, as a file", () => {
  it("reads quoted fields, doubled quotes and either line ending", () => {
    expect(csvRows('a,"b,c","d ""e"""\nf,g,h\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["f", "g", "h"],
    ]);
  });

  it("reads the five columns it needs by name, and says what it refused and why", () => {
    const parsed = parseDirectory(`\uFEFF${CSV}`);
    expect(parsed.entries).toEqual([
      {
        pincode: "605602",
        officeName: "Manampoondi B.O",
        officeType: "BO",
        districtName: "VILLUPURAM",
        stateName: "TAMIL NADU",
      },
      {
        pincode: "605602",
        officeName: 'Mugaiyur "S" O',
        officeType: "SO",
        districtName: "VILLUPURAM",
        stateName: "TAMIL NADU",
      },
    ]);
    expect(parsed.rejected).toEqual([
      { line: 4, reason: "not a pincode: 000000" },
      { line: 5, reason: "office, district or state is blank" },
    ]);
  });

  it("accepts the older editions' district column", () => {
    const older =
      "officename,pincode,districtname,statename\nKottaram B.O,629001,KANNIYAKUMARI,TAMIL NADU";
    expect(parseDirectory(older).entries[0]?.districtName).toBe("KANNIYAKUMARI");
  });

  it("refuses a file without the columns it reads, rather than loading the wrong one", () => {
    expect(() => parseDirectory("office,pin\nA,605602")).toThrow(/no officename, pincode/);
    expect(() => parseDirectory("")).toThrow(/empty/);
  });
});

describe("the directory, through the API", () => {
  const KEY = "sekret-key-123";

  /** Pages of the given sizes, recording the URLs asked for. */
  function pages(sizes: readonly number[], total: number): { http: Http; asked: string[] } {
    const asked: string[] = [];
    let n = 0;
    const http: Http = (url) => {
      asked.push(url);
      const size = sizes[n++] ?? 0;
      const records = Array.from({ length: size }, (_, i) => ({
        OfficeName: `Office ${String(n)}-${String(i)} B.O`,
        Pincode: "605602",
        District: "VILLUPURAM",
        StateName: "TAMIL NADU",
      }));
      return Promise.resolve(new Response(JSON.stringify({ total, records })));
    };
    return { http, asked };
  }

  it("reads every page, pausing between them, and keeps the key out of what it stores", async () => {
    const { http, asked } = pages([2, 2, 1], 5);
    const paused: number[] = [];
    const read = await readDirectoryFromApi({
      apiKey: KEY,
      pageSize: 2,
      http,
      sleep: (ms) => {
        paused.push(ms);
        return Promise.resolve();
      },
    });
    expect(read.records).toHaveLength(5);
    expect(asked.map((u) => new URL(u).searchParams.get("offset"))).toEqual(["0", "2", "4"]);
    expect(paused).toEqual([1_000, 1_000]);
    expect(read.sourceUrl).not.toContain(KEY);
    expect(read.raw).not.toContain(KEY);
    expect(parseApiRecords(read.records).entries).toHaveLength(5);
  });

  it("never lets the key into an error", async () => {
    const http: Http = (url) => Promise.reject(new Error(`refused ${url}`));
    const failure = await readDirectoryFromApi({
      apiKey: KEY,
      http,
      sleep: () => Promise.resolve(),
    }).then(
      () => new Error("expected a failure"),
      (e: unknown) => e as Error,
    );
    expect(failure.message).not.toContain(KEY);
    expect(failure.message).toContain("<api-key>");
  });

  it("reads nothing from a resource that returns no records", async () => {
    const { http } = pages([0], 0);
    expect((await readDirectoryFromApi({ apiKey: KEY, http })).records).toEqual([]);
    expect(parseApiRecords([])).toEqual({ entries: [], rejected: [] });
  });
});

describe("replacing the directory", () => {
  const entry = {
    pincode: "605602",
    officeName: "Manampoondi B.O",
    officeType: "BO",
    districtName: "VILLUPURAM",
    stateName: "TAMIL NADU",
  };

  function fakeDb(failOn?: string): { db: pg.ClientBase; statements: string[] } {
    const statements: string[] = [];
    const db = {
      query: (sql: string) => {
        statements.push(sql.trim().split(/\s+/u).slice(0, 3).join(" "));
        if (failOn !== undefined && sql.includes(failOn)) {
          return Promise.reject(new Error("insert refused"));
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      },
    } as unknown as pg.ClientBase;
    return { db, statements };
  }

  it("swaps the old load for the new inside one transaction", async () => {
    const { db, statements } = fakeDb();
    const inserted = await replaceDirectory(db, {
      entries: [entry],
      sourceSha256: "e".repeat(64),
      datasetVersionId: 9,
    });
    expect(inserted).toBe(1);
    expect(statements).toEqual([
      "BEGIN",
      "DELETE FROM pincode_office",
      "INSERT INTO pincode_office",
      "COMMIT",
    ]);
  });

  it("keeps the old load when the new one cannot be written", async () => {
    const { db, statements } = fakeDb("INSERT INTO pincode_office");
    await expect(
      replaceDirectory(db, { entries: [entry], sourceSha256: "e".repeat(64), datasetVersionId: 9 }),
    ).rejects.toThrow("insert refused");
    expect(statements.at(-1)).toBe("ROLLBACK");
  });
});
