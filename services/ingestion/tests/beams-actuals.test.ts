import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { croresToPaise, scaledToPaise, thousandsToPaise } from "../src/beams/amount";
import { parseDepartmentActuals } from "../src/beams/actuals-parse";

const FIXTURE = new URL("./fixtures/beams-dept-actuals-2024.html", import.meta.url);
const body = await readFile(FIXTURE, "utf8");
const parsed = parseDepartmentActuals(body, 2024);

describe("unit scaling", () => {
  // The same digits mean different amounts in different BEAMS reports. Getting
  // this wrong is a four-order-of-magnitude error on a government figure.
  it("scales crores and thousands differently", () => {
    expect(croresToPaise("1")).toBe(1_000_000_000n); // ₹1 crore
    expect(thousandsToPaise("1")).toBe(100_000n); // ₹1,000
    expect(croresToPaise("1")).toBe((thousandsToPaise("1") ?? 0n) * 10_000n);
  });

  it("keeps crore figures exact", () => {
    expect(croresToPaise("36986.262")).toBe(36_986_262_000_000n);
    expect(scaledToPaise("36986.262", "crores")).toBe(36_986_262_000_000n);
  });

  it("refuses sub-paise precision in crores", () => {
    expect(() => croresToPaise("1.0000000001")).toThrow(/sub-paise/i);
  });
});

describe("parseDepartmentActuals — against a real BEAMS report", () => {
  it("reads every department", () => {
    expect(parsed.rows.length).toBeGreaterThan(20);
  });

  // The scheme-wise export publishes codes only; this report publishes names,
  // which is what lets department.name_en stop being null.
  it("publishes department names, not just codes", () => {
    const pwd = parsed.rows.find((r) => r.deptCode === "H");
    expect(pwd?.deptNameEn).toBe("Public Works");
    expect(parsed.rows.every((r) => r.deptNameEn.length > 0)).toBe(true);
  });

  it("reads the month range from the report", () => {
    expect(parsed.fromMonth).toBe(4);
    expect(parsed.toMonth).toBe(3);
  });

  // Cross-check: these are the figures already in the ledger from a different
  // BEAMS endpoint, in a different unit. Agreement confirms both conversions.
  it("agrees with the scheme-wise export for FY2024-25 Public Works", () => {
    const pwd = parsed.rows.find((r) => r.deptCode === "H");
    expect(pwd?.releasedInr).toBe("369862620000.00");
    expect(pwd?.beamsExpenditureInr).toBe("360492690000.00");
  });

  it("keeps the two expenditure measures separate", () => {
    const pwd = parsed.rows.find((r) => r.deptCode === "H");
    expect(pwd?.beamsExpenditureInr).not.toBeNull();
    // Treasury actual is a different measure and may differ from BEAMS.
    expect(pwd).toHaveProperty("treasuryExpenditureInr");
  });

  it("produces no duplicate department codes", () => {
    expect(new Set(parsed.rows.map((r) => r.deptCode)).size).toBe(parsed.rows.length);
  });
});

describe("parseDepartmentActuals — refusals", () => {
  it("refuses a report that does not declare its unit", () => {
    expect(() =>
      parseDepartmentActuals(body.replace(/Amount in Crores/iu, "Amount"), 2024),
    ).toThrow(/Amount in Crores/i);
  });

  // An empty body from BEAMS means the session was rejected, not that the
  // department has no data. Reporting a successful empty ingest would publish
  // a year as though nothing had been spent.
  it("refuses an empty report and says why", () => {
    expect(() => parseDepartmentActuals("<table></table>", 2024)).toThrow(/Amount in Crores/i);
    const shell =
      "<table><tr><td>Amount in Crores</td></tr><tr><td>Department</td><td>Budgeted</td><td>Released</td><td>BEAMS Expenditure</td></tr></table>";
    expect(() => parseDepartmentActuals(shell, 2024)).toThrow(/session was rejected/i);
  });

  it("refuses a report missing an expected column", () => {
    const noBudget = body.replace(/>Budgeted</u, ">Something<");
    expect(() => parseDepartmentActuals(noBudget, 2024)).toThrow(/missing an expected column/i);
  });
});

describe("parseDepartmentActuals — structural refusals", () => {
  const unit = "<tr><td>Amount in Crores</td></tr>";
  const year = "<tr><td>Financial year :2024-2025</td></tr>";

  it("refuses a report with no Department column", () => {
    expect(() =>
      parseDepartmentActuals(`<table>${year}${unit}<tr><td>X</td></tr></table>`, 2024),
    ).toThrow(/no Department column/i);
  });

  it("refuses a report that lists one department twice", () => {
    const header =
      "<tr><td>Department</td><td>Budgeted</td><td>Released</td><td>BEAMS Expenditure</td></tr>";
    const row = "<tr><td>H -Public Works</td><td>1.000</td><td>1.000</td><td>1.000</td></tr>";
    expect(() =>
      parseDepartmentActuals(`<table>${year}${unit}${header}${row}${row}</table>`, 2024),
    ).toThrow(/appears twice/i);
  });

  it("stops at the first Total row, ignoring the repeated second table", () => {
    const header =
      "<tr><td>Department</td><td>Budgeted</td><td>Released</td><td>BEAMS Expenditure</td></tr>";
    const first = "<tr><td>H -Public Works</td><td>1.000</td><td>1.000</td><td>1.000</td></tr>";
    const total = "<tr><td>Total</td><td>1.000</td><td>1.000</td><td>1.000</td></tr>";
    const second = "<tr><td>H -Public Works</td><td>9.000</td><td>9.000</td><td>9.000</td></tr>";
    const parsedTwice = parseDepartmentActuals(
      `<table>${year}${unit}${header}${first}${total}${header}${second}</table>`,
      2024,
    );
    expect(parsedTwice.rows).toHaveLength(1);
    expect(parsedTwice.rows[0]?.budgetedInr).toBe("10000000.00");
  });
});
