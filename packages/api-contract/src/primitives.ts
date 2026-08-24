import { z } from "zod";

/**
 * Money on the wire is a DECIMAL STRING, never a JSON number.
 * .docs/00-document-audit.md C3: NUMERIC(20,2) at national aggregate scale
 * exceeds Number.MAX_SAFE_INTEGER and fails silently.
 */
export const AmountSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "amount must be an exact decimal string, not a number");

/** Rejects a JSON number explicitly, with a message naming the reason. */
export const StrictAmountSchema = z.preprocess((v) => {
  if (typeof v === "number") {
    throw new Error(
      "amount arrived as a JSON number; the contract requires a decimal string (audit C3)",
    );
  }
  return v;
}, AmountSchema);

export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FiscalYearSchema = z.string().regex(/^FY\d{4}-\d{2}$/);

/**
 * THREE confidences, not one. Audit C4: the docs use "confidence" for three
 * different risks, and conflating them hides the most serious one.
 */
export const ExtractionConfidenceSchema = z.number().min(0).max(1); // did we read it right?
export const LinkageConfidenceSchema = z.number().min(0).max(1);    // does it belong to this project?
export const ScoreConfidenceSchema = z.number().min(0).max(1);      // how sure is the derived score?

/**
 * Provenance travels WITH every fact — never fetched separately.
 * Page anchors (audit C8) are what make "tap a figure, land on the page it came
 * from" possible; without them the product's core promise cannot be delivered.
 */
export const ProvenanceSchema = z.object({
  sourceDocumentId: z.number().int(),
  sourceName: z.string().min(1),
  authority: z.string().min(1),
  tier: z.enum(["central", "state", "local"]),
  sourceUrl: z.string().url().nullable(),
  archivedUrl: z.string().url(),
  artifactSha256: z.string().regex(/^[0-9a-f]{64}$/),
  docType: z.enum(["api", "csv", "xls", "pdf", "scan", "html"]),
  extractionMethod: z.string().min(1),
  extractionConfidence: ExtractionConfidenceSchema,
  linkageConfidence: LinkageConfidenceSchema,
  pageLocator: z.string().nullable(),
  page: z.number().int().positive().nullable(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  retrievedAt: IsoDateTimeSchema,
  publishedAt: IsoDateSchema.nullable(),
  license: z.string().nullable(),
  recordVersion: z.number().int().positive(),
  supersededById: z.number().int().nullable(),
  datasetVersion: z.number().int(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** A value that may be legitimately absent — never rendered as zero (docs/15 rule 8). */
export const MissingSchema = z.object({
  missingReason: z.string().min(1),
  expectedSource: z.string().nullable(),
  lastCheckedAt: IsoDateSchema.nullable(),
});
export type Missing = z.infer<typeof MissingSchema>;

/** Every figure is either present WITH provenance, or explicitly missing. */
export const FigureSchema = z.union([
  z.object({ present: z.literal(true), amountInr: StrictAmountSchema, provenance: ProvenanceSchema }),
  z.object({ present: z.literal(false) }).merge(MissingSchema),
]);
export type Figure = z.infer<typeof FigureSchema>;

/**
 * Neutral text as template key + params, so Marathi/Hindi rendering is possible
 * without the client composing forbidden language (audit C13 / M6).
 */
export const ObservationTextSchema = z.object({
  key: z.string().min(1),
  params: z.record(z.union([z.string(), z.number()])),
  rendered: z.object({ en: z.string().min(1) }).catchall(z.string()),
});
export type ObservationText = z.infer<typeof ObservationTextSchema>;
