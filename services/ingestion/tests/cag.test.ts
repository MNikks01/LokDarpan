import { describe, expect, it } from "vitest";

import { titleFromUrl } from "../src/cag/client";
import { glyphSubstitution } from "../src/cag/extract";
import { scriptOf } from "../src/cag/extract";

describe("scriptOf", () => {
  // CAG reports put the Marathi half first. A search for English terms over the
  // opening third finds nothing and reads exactly like an empty document —
  // which is what happened on the first attempt to assess this source.
  it("tells the two halves of a bilingual report apart", () => {
    expect(scriptOf("Report No. 4 - Compliance Audit")).toBe("latin");
    expect(scriptOf("अनुपालन लेखापरीक्षा अहवाल")).toBe("devanagari");
    expect(scriptOf("महाराष्ट्र शासन Government of Maharashtra")).toBe("mixed");
  });

  it("reports a page with no text as none, not as empty Latin", () => {
    expect(scriptOf("")).toBe("none");
    expect(scriptOf("   \n  ")).toBe("none");
  });

  it("does not mistake digits and punctuation for a script", () => {
    expect(scriptOf("123 ₹ 45.67 — ()")).toBe("none");
  });
});

describe("titleFromUrl", () => {
  // The listing markup does not reliably pair a link with its heading, and a
  // guessed pairing would attach the wrong title to a cited document.
  it("takes the publisher's filename rather than inventing a title", () => {
    expect(
      titleFromUrl(
        "/webroot/uploads/download_audit_report/2026/Nagpur_Report-No.-4-of-2026_Marathi-&-English_hyperlinked-06a50a3c107ba39.98095799.pdf",
      ),
    ).toBe("Nagpur Report No. 4 of 2026 Marathi & English hyperlinked");
  });

  it("survives a filename with no hash suffix", () => {
    expect(titleFromUrl("/x/Report-No-1.pdf")).toBe("Report No 1");
  });
});

import { CagClient, type HttpLike } from "../src/cag/client";
import { extractDocument } from "../src/cag/extract";

function stub(status: number, body: string | Buffer, contentType: string): HttpLike {
  return () => {
    const headers = new Headers({ "content-type": contentType });
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);
    return Promise.resolve(new Response(bytes, { status, headers }));
  };
}

const LISTING =
  `<a href="/webroot/uploads/download_audit_report/2026/Nagpur_Report-No.-4-of-2026-06a5.98.pdf">x</a>` +
  `<a href="/webroot/uploads/download_audit_report/2025/Report-No.-2-of-2025-0687.33.pdf">y</a>` +
  `<a href="/en/some-other-page">z</a>`;

describe("CagClient", () => {
  it("finds report links and ignores other pages", async () => {
    const reports = await new CagClient(
      "https://x.test",
      stub(200, LISTING, "text/html"),
    ).listStateReports();
    expect(reports).toHaveLength(2);
    expect(reports[0]?.url).toContain("https://x.test/webroot/");
  });

  // An empty listing means the page changed, not that a state has no reports.
  it("refuses an empty listing rather than reporting no reports", async () => {
    await expect(
      new CagClient(
        "https://x.test",
        stub(200, "<html>none</html>", "text/html"),
      ).listStateReports(),
    ).rejects.toThrow(/no report links/i);
  });

  it("refuses a non-200 listing", async () => {
    await expect(
      new CagClient("https://x.test", stub(503, "", "text/html")).listStateReports(),
    ).rejects.toThrow(/503/);
  });

  // An HTML body from a PDF URL is an error page. Storing it would put a
  // "not found" page into the evidence chain.
  it("refuses a report served as HTML", async () => {
    await expect(
      new CagClient("https://x.test", stub(200, "<html>404</html>", "text/html")).fetchReport(
        "https://x.test/r.pdf",
      ),
    ).rejects.toThrow(/Expected a PDF/i);
  });

  it("hashes the retrieved bytes", async () => {
    const doc = await new CagClient(
      "https://x.test",
      stub(200, "%PDF-1.4", "application/pdf"),
    ).fetchReport("https://x.test/r.pdf");
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/u);
  });
});

describe("extractDocument", () => {
  it("refuses bytes that are not a PDF rather than storing an empty document", async () => {
    await expect(extractDocument(Buffer.from("not a pdf"))).rejects.toThrow();
  });
});

describe("glyphSubstitution", () => {
  // pagesWithoutText counts pages with no text layer. This is the case it
  // cannot see: a text layer that is present and wrong.
  it("measures zero on clean Marathi", () => {
    expect(glyphSubstitution("महसुली तूट ₹ 29,994.76 कोटी होती आणि वित्तीय तूट वाढली.")).toBe(0);
  });

  // "मेसस! इंडो अलाइड <ोटन फूस" for "मेसर्स इंडो अलाइड प्रोटीन फूड्स".
  it("measures above zero where Latin glyphs are wedged into Devanagari words", () => {
    const ratio = glyphSubstitution("मेसस! इंडो अलाइड <ोटन फूस <ाय}हेट KलKमटेड यांना दे$यात आले");
    expect(ratio).not.toBeNull();
    expect(ratio ?? 0).toBeGreaterThan(0.02);
  });

  // An English page is not evidence of a clean font mapping, and saying 0 would
  // claim a measurement that was never made.
  it("declines to judge a page with too little Devanagari", () => {
    expect(glyphSubstitution("The revenue deficit was ₹ 29,994.76 crore.")).toBeNull();
    expect(glyphSubstitution("")).toBeNull();
  });
});

describe("CagClient.listStates", () => {
  // The filter carries report-type options — Union, Civil, Railways — in a
  // different select. Parsing options loosely would offer "Defence" as a state
  // and fetch nothing under it.
  const page = `<html>
    <select name="type"><option value="49">State</option><option value="61">Defence</option></select>
    <select name="state[]" id="state">
      <option value="78">Madhya Pradesh</option>
      <option value="79">Maharashtra</option>
      <option value="88">Tamil Nadu</option>
    </select></html>`;

  const respondWith =
    (body: string, status = 200): HttpLike =>
    () =>
      Promise.resolve(new Response(body, { status }));

  it("reads only the states, with the ids the filter expects", async () => {
    const states = await new CagClient("https://cag.test", respondWith(page)).listStates();
    expect(states).toEqual([
      { id: 78, name: "Madhya Pradesh" },
      { id: 79, name: "Maharashtra" },
      { id: 88, name: "Tamil Nadu" },
    ]);
  });

  // A state id typed from memory silently fetches another state's reports, so
  // an unreadable page must stop rather than fall back to a guess.
  it("refuses when the page has no state filter", async () => {
    const client = new CagClient("https://cag.test", respondWith("<html>changed</html>"));
    await expect(client.listStates()).rejects.toThrow(/no state filter/);
  });

  it("refuses an empty option list rather than reporting no states", async () => {
    const client = new CagClient(
      "https://cag.test",
      respondWith(`<select name="state[]" id="state"></select>`),
    );
    await expect(client.listStates()).rejects.toThrow(/no options/);
  });
});
