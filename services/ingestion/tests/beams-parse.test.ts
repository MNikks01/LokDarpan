import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { parseBeamsExport } from "../src/beams/parse";

const FIXTURE = new URL("./fixtures/beams-dept-H-2024-sample.xls", import.meta.url);
const body = await readFile(FIXTURE, "utf8");
const parsed = parseBeamsExport(body);

describe("parseBeamsExport — against a real BEAMS export captured 2026-08-26", () => {
  it("reads the financial year from the export itself", () => {
    expect(parsed.fiscalYear).toBe(2024);
  });

  it("finds data rows", () => {
    expect(parsed.rows.length).toBeGreaterThan(10);
  });

  it("reads Public Works rows", () => {
    expect(parsed.rows.every((r) => r.deptCode === "H")).toBe(true);
    expect(parsed.rows.every((r) => /^H-\d+$/u.test(r.demandNo))).toBe(true);
  });

  it("converts amounts out of thousands into rupees", () => {
    const withBudget = parsed.rows.find((r) => r.allocatedInr !== null);
    expect(withBudget).toBeDefined();
    // A rupee string, two decimals, and never the raw thousands figure.
    expect(withBudget?.allocatedInr).toMatch(/^-?\d+\.\d{2}$/u);
  });

  it("keeps the Marathi scheme name where published", () => {
    const localized = parsed.rows.filter((r) => r.schemeNameLocal !== null);
    expect(localized.length).toBeGreaterThan(0);
    expect(localized.some((r) => /[ऀ-ॿ]/u.test(r.schemeNameLocal ?? ""))).toBe(true);
  });

  // BEAMS publishes an explicit 0.000 rather than a blank cell, so a zero must
  // survive as a zero. Turning it into null would erase a figure the government
  // did assert.
  it("preserves a published zero as zero, not null", () => {
    const zeros = parsed.rows.filter((r) => r.utilizedInr === "0.00");
    expect(zeros.length).toBeGreaterThan(0);
    expect(zeros.every((r) => r.utilizedInr !== null)).toBe(true);
  });

  it("records a genuinely absent cell as null", () => {
    // "--" is what BEAMS writes where it publishes nothing; the fixture uses it
    // in "Source of fund".
    const absent = parsed.rows.filter((r) => r.sourceOfFund === null);
    expect(absent.length).toBeGreaterThan(0);
  });
});

describe("parseBeamsExport — refusals", () => {
  const header =
    "<tr><td>Financial year :2024-2025</td></tr><tr><td>Amounts In Thousands</td></tr>" +
    "<tr><td>DEPT</td><td>DEMAND_NO</td><td>SCHEME_CODE</td><td>OBJECT_CODE</td>" +
    "<td>BUDGET</td><td>EXPENDITURE</td></tr>";

  // The unit determines every figure on the page.
  it("refuses an export that does not declare its unit", () => {
    const noUnit = body.replace(/Amounts In Thousands/iu, "Amounts In Crores");
    expect(() => parseBeamsExport(noUnit)).toThrow(/Amounts In Thousands/i);
  });

  it("refuses an export that does not state its financial year", () => {
    const noYear = body.replace(/Financial year :\d{4}-\d{4}/iu, "Report");
    expect(() => parseBeamsExport(noYear)).toThrow(/financial year/i);
  });

  it("refuses a missing column rather than shifting positions", () => {
    const dropped = header.replace("<td>BUDGET</td>", "");
    expect(() => parseBeamsExport(`<table>${dropped}<tr><td>H</td></tr></table>`)).toThrow(
      /missing column/i,
    );
  });

  it("refuses to report an empty ingest as success", () => {
    expect(() => parseBeamsExport(`<table>${header}</table>`)).toThrow(/no data rows/i);
  });
});

describe("parseBeamsExport — rows without coordinates", () => {
  const preamble =
    "<tr><td>Financial year :2024-2025</td></tr><tr><td>Amounts In Thousands</td></tr>";
  const header =
    "<tr><td>DEPT</td><td>DEMAND_NO</td><td>SCHEME_CODE</td><td>OBJECT_CODE</td>" +
    "<td>BUDGET</td><td>EXPENDITURE</td></tr>";
  const cells = (...v: string[]): string => `<tr>${v.map((x) => `<td>${x}</td>`).join("")}</tr>`;

  // Subtotal and spacer rows carry amounts but no chart-of-accounts
  // coordinates. Loading them would double-count against a scheme that does
  // not exist.
  it("skips a row missing its scheme code rather than guessing one", () => {
    const html =
      `<table>${preamble}${header}` +
      cells("H", "H-07", "", "01", "100.000", "50.000") +
      cells("H", "H-07", "30510768", "01", "100.000", "50.000") +
      `</table>`;
    const result = parseBeamsExport(html);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.schemeCode).toBe("30510768");
  });

  it("skips a row missing its object code", () => {
    const html =
      `<table>${preamble}${header}` +
      cells("H", "H-07", "30510768", "", "100.000", "50.000") +
      cells("H", "H-07", "30510768", "02", "100.000", "50.000") +
      `</table>`;
    expect(parseBeamsExport(html).rows).toHaveLength(1);
  });

  it("refuses an export with no header row at all", () => {
    const html = `<table>${preamble}${cells("H", "H-07", "30510768", "01", "1.000", "1.000")}</table>`;
    expect(() => parseBeamsExport(html)).toThrow(/header row|missing column/i);
  });

  it("reads a column that is absent as unpublished rather than failing", () => {
    // No RELEASED columns at all — older or narrower exports.
    const html =
      `<table>${preamble}${header}` +
      cells("H", "H-07", "30510768", "01", "100.000", "50.000") +
      `</table>`;
    const row = parseBeamsExport(html).rows[0];
    expect(row?.releasedInr).toBeNull();
    expect(row?.releasedFdInr).toBeNull();
    expect(row?.allocatedInr).toBe("100000.00");
  });
});
