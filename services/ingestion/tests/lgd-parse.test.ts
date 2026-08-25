import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { localName, parseStates } from "../src/lgd/parse.js";

const FIXTURE = new URL("./fixtures/lgd-states-2026-08-25.html", import.meta.url);

const html = await readFile(FIXTURE, "utf8");
const states = parseStates(html);

describe("parseStates — against a real LGD response captured 2026-08-25", () => {
  it("finds all 36 States and Union Territories", () => {
    expect(states).toHaveLength(36);
  });

  it("reads LGD codes, not serial numbers", () => {
    const mh = states.find((s) => s.nameEn === "Maharashtra");
    expect(mh?.lgdCode).toBe("27");
    expect(states.find((s) => s.nameEn === "Andhra Pradesh")?.lgdCode).toBe("28");
  });

  it("distinguishes Union Territories from States", () => {
    expect(states.find((s) => s.nameEn.startsWith("Andaman"))?.isUnionTerritory).toBe(true);
    expect(states.find((s) => s.nameEn === "Assam")?.isUnionTerritory).toBe(false);
    // LGD lists 8 UTs; a change here means the country's composition changed
    // or the parser regressed, and both deserve a failing test.
    expect(states.filter((s) => s.isUnionTerritory)).toHaveLength(8);
  });

  it("keeps a genuine local-script name, normalised to NFC", () => {
    const local = states.find((s) => s.nameEn === "Chhattisgarh")?.nameLocal;
    expect(local).toBe("\u091b\u0924\u094d\u0924\u0940\u0938\u0917\u095d".normalize("NFC"));
    // LGD emits this decomposed; stored form must be NFC or search misses it.
    expect(local).toBe(local?.normalize("NFC"));
  });

  // The bug this parser exists to avoid. LGD's local-language column repeats
  // the English name in upper case for most states; storing "ASSAM" as a local
  // name would render it as though it were Marathi.
  it("records an upper-case English repeat as not-published, not as a local name", () => {
    expect(states.find((s) => s.nameEn === "Assam")?.nameLocal).toBeNull();
    expect(states.find((s) => s.nameEn === "Bihar")?.nameLocal).toBeNull();
  });

  it("finds local names for exactly the states that publish one", () => {
    const localized = states.filter((s) => s.nameLocal !== null);
    expect(localized.length).toBeGreaterThan(0);
    expect(localized.length).toBeLessThan(states.length);
    for (const s of localized) {
      expect(s.nameLocal).not.toBe(s.nameEn.toUpperCase());
    }
  });

  it("captures census codes where present", () => {
    expect(states.find((s) => s.nameEn === "Uttar Pradesh")?.census2011Code).toBe("09");
  });

  it("produces no duplicate LGD codes", () => {
    expect(new Set(states.map((s) => s.lgdCode)).size).toBe(states.length);
  });
});

describe("parseStates — refusals", () => {
  it("refuses a table whose expected columns are absent", () => {
    expect(() => parseStates("<table><tr><th>Something Else</th></tr></table>")).toThrow(
      /missing expected column/i,
    );
  });

  it("refuses to report an empty ingest as success", () => {
    const headersOnly =
      "<table><tr>" +
      ["State LGD Code", "State Name (In English)", "State Name (In Local language)", "State or UT"]
        .map((h) => `<th>${h}</th>`)
        .join("") +
      "</tr></table>";
    expect(() => parseStates(headersOnly)).toThrow(/no data rows/i);
  });
});

describe("localName", () => {
  it("keeps Devanagari, including combining marks", () => {
    expect(localName("Chhattisgarh", "छत्तीसगढ़")).toBe("छत्तीसगढ़");
  });

  it("keeps other Indic scripts", () => {
    expect(localName("Tamil Nadu", "தமிழ்நாடு")).toBe("தமிழ்நாடு");
    expect(localName("West Bengal", "পশ্চিমবঙ্গ")).toBe("পশ্চিমবঙ্গ");
  });

  it("rejects a Latin-script value however it is cased", () => {
    expect(localName("Assam", "ASSAM")).toBeNull();
    expect(localName("Assam", "Assam")).toBeNull();
    expect(localName("Andaman", "ANDAMAN AND NICOBAR ISLANDS")).toBeNull();
  });

  it("treats blank and whitespace as not-published", () => {
    expect(localName("Assam", "")).toBeNull();
    expect(localName("Assam", "   ")).toBeNull();
  });

  it("is not fooled by digits or punctuation in a Latin value", () => {
    expect(localName("Dadra", "DADRA & NAGAR HAVELI (UT)")).toBeNull();
  });
});

const HEADERS = [
  "State LGD Code",
  "State Name (In English)",
  "State Name (In Local language)",
  "State or UT",
]
  .map((h) => `<th>${h}</th>`)
  .join("");

/** A table with valid headers and one caller-supplied data row. */
const tableWith = (cells: readonly string[]): string =>
  `<table><tr>${HEADERS}</tr><tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr></table>`;

describe("parseStates — malformed rows are refused, never guessed at", () => {
  it("refuses a non-numeric LGD code", () => {
    expect(() =>
      parseStates(tableWith(["1", "TWENTY-SEVEN", "Maharashtra", "", "State", "", ""])),
    ).toThrow(/is not numeric/i);
  });

  it("refuses a row with no English name", () => {
    expect(() => parseStates(tableWith(["1", "27", "", "", "State", "", ""]))).toThrow(
      /no English name/i,
    );
  });

  it("refuses an unrecognised State-or-UT value", () => {
    expect(() =>
      parseStates(tableWith(["1", "27", "Maharashtra", "", "Province", "", ""])),
    ).toThrow(/Unexpected "State or UT"/i);
  });

  it("accepts both State and UT spellings case-insensitively", () => {
    expect(
      parseStates(tableWith(["1", "27", "Maharashtra", "", "state", "", ""]))[0]?.isUnionTerritory,
    ).toBe(false);
    expect(
      parseStates(tableWith(["1", "35", "Andaman", "", "ut", "", ""]))[0]?.isUnionTerritory,
    ).toBe(true);
  });

  it("refuses a response containing the same LGD code twice", () => {
    const row = `<tr>${["1", "27", "Maharashtra", "", "State", "", ""].map((c) => `<td>${c}</td>`).join("")}</tr>`;
    expect(() => parseStates(`<table><tr>${HEADERS}</tr>${row}${row}</table>`)).toThrow(
      /Duplicate LGD code/i,
    );
  });

  it("skips layout rows that do not begin with a serial number", () => {
    const note = `<tr><td colspan="7">* Note : UT-Union Territory</td></tr>`;
    const row = `<tr>${["1", "27", "Maharashtra", "", "State", "", ""].map((c) => `<td>${c}</td>`).join("")}</tr>`;
    expect(parseStates(`<table><tr>${HEADERS}</tr>${note}${row}</table>`)).toHaveLength(1);
  });

  it("treats an absent census code as null, not as a code", () => {
    const parsed = parseStates(tableWith(["1", "27", "Maharashtra", "", "State", "-", "NA"]));
    expect(parsed[0]?.census2001Code).toBeNull();
    expect(parsed[0]?.census2011Code).toBeNull();
    expect(
      parseStates(tableWith(["1", "27", "Maharashtra", "", "State", "", ""]))[0]?.census2001Code,
    ).toBeNull();
  });
});
