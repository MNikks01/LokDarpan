import { describe, expect, it } from "vitest";

import { isCorrectionSubject, parseCorrection } from "../src/correction";

const valid = {
  subject: "fact:123",
  category: "amount_wrong",
  description: "Page 12 prints 4.5 crore, not 45 crore.",
  evidenceUrl: "https://cag.gov.in/report.pdf",
};

describe("parseCorrection", () => {
  it("accepts a complete report, trimmed, and an empty evidence field as none", () => {
    expect(parseCorrection({ ...valid, description: `  ${valid.description}  ` })).toEqual({
      ok: true,
      value: { ...valid },
    });
    expect(parseCorrection({ ...valid, evidenceUrl: "  " })).toMatchObject({
      ok: true,
      value: { evidenceUrl: null },
    });
  });

  it("names every field that needs changing, not only the first", () => {
    const r = parseCorrection({
      subject: "fact:abc",
      category: "fraud",
      description: "short",
      evidenceUrl: "javascript:alert(1)",
    });
    expect(r).toEqual({
      ok: false,
      problems: ["subject", "category", "description_short", "evidence_url"],
    });
  });

  it("refuses a description longer than the database accepts", () => {
    expect(parseCorrection({ ...valid, description: "x".repeat(4001) })).toEqual({
      ok: false,
      problems: ["description_long"],
    });
  });

  it("marks a submission that filled the field no person sees", () => {
    expect(parseCorrection({ ...valid, website: "http://spam.example" })).toEqual({
      ok: false,
      problems: ["automated"],
    });
  });

  it("treats a field of the wrong type as missing, never as text", () => {
    expect(parseCorrection({ ...valid, description: 42 })).toEqual({
      ok: false,
      problems: ["description_short"],
    });
  });
});

describe("isCorrectionSubject", () => {
  it.each(["fact:1", "document:12", "body:4", "unit:20", "tender:9", "page:/", "page:/units/20"])(
    "accepts %s",
    (s) => {
      expect(isCorrectionSubject(s)).toBe(true);
    },
  );

  it.each(["fact:0", "fact:", "person:3", "page:units", "page:/a b", `page:/${"x".repeat(301)}`])(
    "refuses %s",
    (s) => {
      expect(isCorrectionSubject(s)).toBe(false);
    },
  );
});
