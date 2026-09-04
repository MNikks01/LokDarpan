import { describe, expect, it } from "vitest";

import { extractDocument } from "../src/cag/extract";

/**
 * A one-page PDF, assembled here rather than committed as a binary.
 *
 * `extractDocument` is where every coordinate in the ledger comes from, and a
 * fixture that can be read is worth more than one that can only be trusted: the
 * page box, the rotation and the text position below are visible in the test
 * that asserts on them, so a change in what pdf.js reports shows up as a
 * disagreement with a stated expectation rather than with an opaque file.
 */
function onePagePdf(options: { rotate: number; text: string; x: number; y: number }): Buffer {
  const stream = `BT /F1 12 Tf ${String(options.x)} ${String(options.y)} Td (${options.text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      `/Rotate ${String(options.rotate)} ` +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`,
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [i, object] of objects.entries()) {
    offsets.push(body.length);
    body += `${String(i + 1)} 0 obj\n${object}\nendobj\n`;
  }

  const startxref = body.length;
  // The cross-reference table is written correctly rather than left for pdf.js
  // to reconstruct, so the test exercises the ordinary path a real report takes.
  let xref = `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\n`;
  xref += `startxref\n${String(startxref)}\n%%EOF\n`;

  return Buffer.from(body + xref, "latin1");
}

describe("extractDocument reads a page's text and where it sits", () => {
  it("returns the page's unrotated box and its declared rotation", async () => {
    const doc = await extractDocument(
      onePagePdf({ rotate: 90, text: "Rs 15.14 crore", x: 72, y: 700 }),
    );

    expect(doc.pageCount).toBe(1);
    const page = doc.pages[0];
    // A quarter turn does not change the box the file states, and the
    // coordinates below are in that same space. Reporting the upright box here
    // is what once put boxes off the edge of their own page.
    expect(page?.width).toBe(612);
    expect(page?.height).toBe(792);
    expect(page?.rotation).toBe(90);
  });

  it("places a text item where the content stream put it", async () => {
    const doc = await extractDocument(
      onePagePdf({ rotate: 0, text: "Rs 15.14 crore", x: 72, y: 700 }),
    );
    const page = doc.pages[0];

    expect(page?.content).toBe("Rs 15.14 crore");
    expect(page?.items).toHaveLength(1);
    const item = page?.items[0];
    expect(item?.x0).toBe(72);
    expect(item?.y0).toBe(700);
    // A width pdf.js measures from the font, so only its direction is asserted.
    expect(item?.x1).toBeGreaterThan(72);
    expect(item?.y1).toBeGreaterThan(700);
  });

  it("addresses the page text by the span it reports", async () => {
    const doc = await extractDocument(
      onePagePdf({ rotate: 0, text: "Rs 15.14 crore", x: 72, y: 700 }),
    );
    const page = doc.pages[0];
    const item = page?.items[0];
    expect((page?.content ?? "").slice(item?.charStart, item?.charEnd)).toBe("Rs 15.14 crore");
  });

  it("reports a page with no text as unreadable rather than blank", async () => {
    const doc = await extractDocument(onePagePdf({ rotate: 0, text: "", x: 72, y: 700 }));
    expect(doc.pages[0]?.content).toBeNull();
    expect(doc.pagesWithoutText).toBe(1);
    expect(doc.pages[0]?.script).toBe("none");
  });

  it("normalises a rotation the file states outside 0-359", async () => {
    const doc = await extractDocument(onePagePdf({ rotate: -90, text: "x", x: 10, y: 10 }));
    expect(doc.pages[0]?.rotation).toBe(270);
  });
});
