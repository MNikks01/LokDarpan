import { describe, it, expect } from "vitest";

import {
  districtFromChain,
  labelledValues,
  normalise,
  parseDetail,
  rupeesToPaise,
} from "../src/gepnic/detail";

/**
 * Every chain asserted here was read off `tntenders.gov.in` on 2026-09-01.
 * The two shapes are real and different, which is the whole difficulty.
 */
const RD_CHAIN =
  "Rural Development and Panchayat Raj Department||Villupuram,RD,TN||MUGAIYUR - VP, VILLUPURAM,RD,TN";
const TANGEDCO_CHAIN =
  "TNEB Limited||TANGEDCO||CE-Tirunelveli - TANGEDCO||SE-Kannyakumari - TANGEDCO";

/** Tamil Nadu's districts as the ledger spells them, normalised. */
const TN = new Set(
  ["Viluppuram", "Kanniyakumari", "Tirunelveli", "Tiruvannamalai", "Chennai"].map(normalise),
);

function page(fields: Record<string, string>): string {
  const rows = Object.entries(fields)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
  return `<table>${rows}</table>`;
}

describe("transliteration — one place, two spellings", () => {
  it("reaches the ledger's spelling from the portal's", () => {
    // The portal writes Villupuram; OpenStreetMap writes Viluppuram. Same
    // district, and an exact-match join would find neither.
    expect(normalise("Villupuram")).toBe(normalise("Viluppuram"));
    expect(normalise("Kannyakumari")).toBe(normalise("Kanniyakumari"));
  });

  it("still separates places that merely look similar", () => {
    expect(normalise("Chennai")).not.toBe(normalise("Salem"));
  });

  it("is only safe within one state, which is why the scope is narrowed", () => {
    // Across all 787 districts this normalisation collapses eighteen pairs of
    // genuinely different places. Pune and Panna are a thousand kilometres and
    // two states apart, and this is the evidence that a nationwide candidate
    // set would place a tender in the wrong one while looking confident.
    expect(normalise("Pune")).toBe(normalise("Panna"));
    expect(normalise("Karnal")).toBe(normalise("Kurnool"));
    // Neither is in Tamil Nadu, so a Tamil Nadu portal can never reach them.
    expect(TN.has(normalise("Pune"))).toBe(false);
  });
});

describe("which district issued the tender", () => {
  it("reads a clean chain segment, stripping the state suffix", () => {
    const found = districtFromChain(RD_CHAIN.split("||"), TN);
    expect(found?.name).toBe("Villupuram");
    expect(found?.source).toBe("chain_unit");
  });

  it("prefers the narrower office when the chain names two districts", () => {
    // CE-Tirunelveli is a circle spanning several districts; SE-Kannyakumari is
    // a division inside it. The chain runs general to specific, so the deepest
    // match is the better answer.
    const found = districtFromChain(TANGEDCO_CHAIN.split("||"), TN);
    expect(found?.name).toBe("Kannyakumari");
    expect(found?.source).toBe("office_code");
  });

  it("marks a district dug out of an office name as the weaker claim", () => {
    // An office code is not a statement of where the work is, so downstream
    // confidence must be able to tell the two apart.
    expect(districtFromChain(TANGEDCO_CHAIN.split("||"), TN)?.source).toBe("office_code");
    expect(districtFromChain(RD_CHAIN.split("||"), TN)?.source).toBe("chain_unit");
  });

  it("never matches the department itself", () => {
    // Segment 0 is the department. A department named after a city would
    // otherwise place every one of its tenders there.
    expect(districtFromChain(["Chennai", "Some Wing"], TN)).toBeNull();
  });

  it("finds nothing rather than guessing when no district is named", () => {
    expect(districtFromChain(["Highways Department", "Head Office"], TN)).toBeNull();
  });

  it("finds nothing when the district is real but not in this state's set", () => {
    // The safety property: a name we cannot point to on this state's map is not
    // a placement, however plausible it looks.
    expect(districtFromChain(["Dept", "Pune,RD,MH"], TN)).toBeNull();
  });
});

describe("money as the portal prints it", () => {
  it("reads the Indian grouping into paise", () => {
    expect(rupeesToPaise("5,92,000")).toBe(59_200_000n);
    expect(rupeesToPaise("4,500")).toBe(450_000n);
  });

  it("keeps paise exactly, without a float in the path", () => {
    expect(rupeesToPaise("1,234.56")).toBe(123_456n);
    expect(rupeesToPaise("0.05")).toBe(5n);
  });

  it("reads NA as absent, never as zero", () => {
    // Most tenders print NA. Rendering that as ₹0 would state that a government
    // advertised work worth nothing.
    expect(rupeesToPaise("NA")).toBeNull();
    expect(rupeesToPaise("")).toBeNull();
    expect(rupeesToPaise(undefined)).toBeNull();
  });

  it("refuses text it cannot read rather than salvaging digits from it", () => {
    expect(rupeesToPaise("Nil")).toBeNull();
    expect(rupeesToPaise("as per schedule")).toBeNull();
  });

  it("survives a figure larger than a double can hold exactly", () => {
    // A national multi-year aggregate exceeds Number.MAX_SAFE_INTEGER, and the
    // failure would be silent.
    expect(rupeesToPaise("99,99,99,99,99,999")).toBe(999_999_999_999_900n);
  });
});

describe("the page as a whole", () => {
  it("reads the fields a reader is entitled to see", () => {
    const detail = parseDetail(
      page({
        "Organisation Chain": RD_CHAIN,
        Location: "Manampoondi",
        Pincode: "605602",
        "Tender Category": "Works",
        "Product Category": "Civil Works",
        "Tender Type": "Open Tender",
        "Tender Value in ₹": "5,92,000",
        "EMD Amount in ₹": "4,500",
      }),
      TN,
    );
    expect(detail?.department).toBe("Rural Development and Panchayat Raj Department");
    expect(detail?.districtName).toBe("Villupuram");
    expect(detail?.location).toBe("Manampoondi");
    expect(detail?.pincode).toBe("605602");
    expect(detail?.tenderValuePaise).toBe(59_200_000n);
    expect(detail?.organisationChain).toHaveLength(3);
  });

  it("holds a tender whose district it could not place", () => {
    // Missing is never zero, and it is never a reason to discard a real
    // advertisement either. It is simply unplaced.
    const detail = parseDetail(
      page({ "Organisation Chain": "Highways Department||Head Office" }),
      TN,
    );
    expect(detail?.department).toBe("Highways Department");
    expect(detail?.districtName).toBeNull();
    expect(detail?.districtSource).toBeNull();
  });

  it("reads NA fields as absent rather than printing the letters", () => {
    const detail = parseDetail(
      page({ "Organisation Chain": RD_CHAIN, "Tender Value in ₹": "NA", Location: "NA" }),
      TN,
    );
    expect(detail?.tenderValuePaise).toBeNull();
    expect(detail?.location).toBeNull();
  });

  it("refuses a page that names no organisation", () => {
    // Without a chain there is no department and no district — nothing this
    // feature exists to show.
    expect(parseDetail(page({ Location: "Somewhere" }), TN)).toBeNull();
    expect(parseDetail("<html>Stale Session</html>", TN)).toBeNull();
  });

  it("ignores a cell pair that is a layout artefact, not a field", () => {
    // GePNIC nests layout tables inside the detail table. Three guards keep
    // their cells out of the field map: a blank value, a "label" far too long
    // to be one, and a cell repeated into both positions. Without them a
    // paragraph of boilerplate becomes a field with a plausible name.
    const noise =
      "<tr><td>Blank</td><td></td></tr>" +
      `<tr><td>${"x".repeat(60)}</td><td>value</td></tr>` +
      "<tr><td>Echoed</td><td>Echoed</td></tr>";
    const pairs = labelledValues(noise);
    expect(pairs.has("Blank")).toBe(false);
    expect(pairs.has("Echoed")).toBe(false);
    expect(pairs.size).toBe(0);
  });

  it("keeps the first value when a label appears more than once", () => {
    const pairs = labelledValues(page({ Location: "First" }) + page({ Location: "Second" }));
    expect(pairs.get("Location")).toBe("First");
  });
});
