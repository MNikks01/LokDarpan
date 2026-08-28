/**
 * Demo source documents and the provenance records that cite them.
 *
 * WHY THE URLS ARE `.invalid`
 * RFC 2606 reserves `.invalid` as a TLD guaranteed never to resolve. A
 * plausible-looking `gov.in` URL in demo data is the one mistake this
 * repository cannot afford: it would put a fabricated citation next to a real
 * authority's name. These are structurally valid URLs that provably lead
 * nowhere, which is exactly what a demo citation should be.
 *
 * Every field the real contract requires is populated, so the demo exercises
 * the same `<Figure>` code path as production. Nothing here is a government
 * record — see `DEMO_DATA_NOTICE`.
 */
import type { Provenance } from "@lokdarpan/contracts";
import type { SourceDocument } from "@/domain/project";

export { DEMO_DATA_NOTICE } from "./notice";

export const DEMO_DATASET_VERSION = 7;

/**
 * A deterministic 64-hex digest stand-in. Not a real SHA-256 of anything: it
 * exists so the shape and the layout are exercised, and it is derived from the
 * id so the same demo document always shows the same digest.
 */
function demoDigest(seed: number): string {
  let x = seed * 2654435761 + 0x9e3779b9;
  let out = "";
  while (out.length < 64) {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    out += x.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

interface DemoSourceSeed {
  readonly id: number;
  readonly title: string;
  readonly authority: string;
  readonly tier: Provenance["tier"];
  readonly docType: Provenance["docType"];
  readonly publishedOn: string | null;
  readonly page: number | null;
  readonly extractionMethod: string;
  readonly extractionConfidence: number;
  readonly linkageConfidence: number;
}

const SEEDS: readonly DemoSourceSeed[] = [
  {
    id: 9101,
    title: "Annual works programme — roads, Nagpur circle",
    authority: "Example State Public Works Department",
    tier: "state",
    docType: "pdf",
    publishedOn: "2022-04-18",
    page: 14,
    extractionMethod: "table extraction",
    extractionConfidence: 0.97,
    linkageConfidence: 0.99,
  },
  {
    id: 9102,
    title: "Tender notice register 2022-23",
    authority: "Example State Public Works Department",
    tier: "state",
    docType: "html",
    publishedOn: "2022-01-10",
    page: null,
    extractionMethod: "structured feed",
    extractionConfidence: 0.99,
    linkageConfidence: 0.99,
  },
  {
    id: 9103,
    title: "Work order abstract — Nagpur division",
    authority: "Example State Public Works Department",
    tier: "state",
    docType: "scan",
    publishedOn: "2022-02-21",
    page: 3,
    extractionMethod: "OCR, reviewed",
    extractionConfidence: 0.86,
    linkageConfidence: 0.98,
  },
  {
    id: 9104,
    title: "Municipal capital works statement 2023-24",
    authority: "Example Municipal Corporation, Nagpur",
    tier: "local",
    docType: "xls",
    publishedOn: "2023-06-02",
    page: null,
    extractionMethod: "spreadsheet parse",
    extractionConfidence: 0.98,
    linkageConfidence: 0.93,
  },
  {
    id: 9105,
    title: "Rural connectivity works register",
    authority: "Example Rural Development Department",
    tier: "state",
    docType: "csv",
    publishedOn: "2023-01-30",
    page: null,
    extractionMethod: "structured feed",
    extractionConfidence: 0.99,
    linkageConfidence: 0.88,
  },
  {
    id: 9106,
    title: "National corridor progress statement",
    authority: "Example National Highways Authority",
    tier: "central",
    docType: "pdf",
    publishedOn: "2024-02-11",
    page: 47,
    extractionMethod: "table extraction",
    extractionConfidence: 0.94,
    linkageConfidence: 0.99,
  },
  {
    id: 9107,
    title: "Completion certificates issued, FY 2023-24",
    authority: "Example State Public Works Department",
    tier: "state",
    docType: "pdf",
    publishedOn: "2024-04-09",
    page: 8,
    extractionMethod: "table extraction",
    extractionConfidence: 0.96,
    linkageConfidence: 0.99,
  },
];

function toProvenance(seed: DemoSourceSeed): Provenance {
  return {
    sourceDocumentId: seed.id,
    sourceName: seed.title,
    authority: seed.authority,
    tier: seed.tier,
    sourceUrl: `https://records.demo.invalid/${String(seed.id)}`,
    archivedUrl: `https://archive.demo.invalid/${String(seed.id)}`,
    artifactSha256: demoDigest(seed.id),
    docType: seed.docType,
    extractionMethod: seed.extractionMethod,
    extractionConfidence: seed.extractionConfidence,
    linkageConfidence: seed.linkageConfidence,
    pageLocator: seed.page === null ? null : `p. ${String(seed.page)}`,
    page: seed.page,
    bbox: null,
    retrievedAt: "2026-08-14T06:30:00+05:30",
    publishedAt: seed.publishedOn,
    license: "Demo Source — not a government publication",
    recordVersion: 1,
    supersededById: null,
    datasetVersion: DEMO_DATASET_VERSION,
  };
}

export const DEMO_SOURCES: readonly SourceDocument[] = SEEDS.map((seed) => ({
  id: seed.id,
  title: seed.title,
  authority: seed.authority,
  publishedOn: seed.publishedOn,
  retrievedAt: "2026-08-14T06:30:00+05:30",
  provenance: toProvenance(seed),
}));

const BY_ID = new Map(DEMO_SOURCES.map((s) => [s.id, s]));

export function demoProvenance(sourceDocumentId: number): Provenance {
  const source = BY_ID.get(sourceDocumentId);
  if (source === undefined) {
    throw new Error(`demo source ${String(sourceDocumentId)} is not defined`);
  }
  return source.provenance;
}

export function demoSource(sourceDocumentId: number): SourceDocument | null {
  return BY_ID.get(sourceDocumentId) ?? null;
}

/** A present amount with its citation — the only way demo money is built. */
export function demoAmount(
  amountInr: string,
  sourceDocumentId: number,
): { readonly present: true; readonly amountInr: string; readonly provenance: Provenance } {
  return { present: true, amountInr, provenance: demoProvenance(sourceDocumentId) };
}

/** An amount the records do not carry. Never rendered as zero (docs/15 rule 8). */
export function demoMissingAmount(
  missingReason: string,
  expectedSource: string,
): {
  readonly present: false;
  readonly missingReason: string;
  readonly expectedSource: string;
  readonly lastCheckedAt: string;
} {
  return { present: false, missingReason, expectedSource, lastCheckedAt: "2026-08-14" };
}
