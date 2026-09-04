import { z } from "zod";

/**
 * The wire contract between the ingestion pipeline and the OCR service.
 *
 * The service is Python and speaks snake_case; this repository is TypeScript
 * and speaks camelCase. The schemas below describe **the wire**, exactly as it
 * is, and `toReading` converts once at the boundary. Naming the wire honestly
 * is what lets the two sides be checked against the same example documents
 * rather than against each other's intentions.
 *
 * The three rules the Python contract states apply here identically:
 * a reading carries the engine and version that produced it; nothing is merged;
 * an absence is a stated refusal, never a shorter list.
 */

export const OCR_CONTRACT_VERSION = "ocr/1";

const ContractVersionSchema = z.literal(OCR_CONTRACT_VERSION);

/** Normalised 0..1. Tesseract reports 0..100 and converts at its adapter. */
const ConfidenceSchema = z.number().min(0).max(1);

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "a document is named by its content hash");

export const OcrRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

/**
 * One piece of recognised text and where it sits, in PDF points, origin
 * bottom-left, in the page's unrotated space — the same space
 * `document_text_item` stores, so an OCR reading needs no second code path.
 */
export const OcrTextItemSchema = z
  .object({
    seq: z.number().int().min(0),
    char_start: z.number().int().min(0),
    char_end: z.number().int().min(0),
    x0: z.number(),
    y0: z.number(),
    x1: z.number(),
    y1: z.number(),
    confidence: ConfidenceSchema,
  })
  .strict()
  .refine((i) => i.char_end >= i.char_start, "char_end precedes char_start")
  .refine((i) => i.x1 >= i.x0 && i.y1 >= i.y0, "box corners are not ordered lower-left first");

export const OcrEngineIdentitySchema = z
  .object({
    name: z.string().min(1),
    // Read from the installed engine at runtime. A recorded "latest" would make
    // a reading unreproducible the moment the image is rebuilt.
    version: z.string().min(1),
    model_versions: z.record(z.string()).default({}),
    languages: z.array(z.string()).min(1),
  })
  .strict();

export const OcrRenderSchema = z
  .object({
    dpi: z.number().int().positive(),
    raster_width: z.number().int().positive(),
    raster_height: z.number().int().positive(),
    /** The unrotated page box, not the upright one a viewer sees. */
    page_width: z.number().positive(),
    page_height: z.number().positive(),
    rotation: OcrRotationSchema,
  })
  .strict();

export const OcrPageReadingSchema = z
  .object({
    page_number: z.number().int().min(1),
    engine: OcrEngineIdentitySchema,
    render: OcrRenderSchema,
    content: z.string(),
    items: z.array(OcrTextItemSchema),
  })
  .strict()
  .refine(
    (r) => r.items.every((i) => i.char_end <= r.content.length),
    "an item addresses text that is not in the content it arrived with",
  );

/**
 * A page an engine did not read, and why.
 *
 * Present so a short response is never mistaken for a clean one. "The engine is
 * not installed" and "the engine found no text" are different facts, and
 * neither of them is "the page is blank".
 */
export const OcrRefusalSchema = z
  .object({
    page_number: z.number().int().min(1).nullable().default(null),
    engine: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

export const OcrReadResponseSchema = z
  .object({
    contract_version: ContractVersionSchema,
    document_sha256: Sha256Schema,
    readings: z.array(OcrPageReadingSchema),
    refusals: z.array(OcrRefusalSchema),
  })
  .strict();

export const OcrEngineStatusSchema = z
  .object({
    name: z.string().min(1),
    available: z.boolean(),
    version: z.string().nullable().default(null),
    detail: z.string().nullable().default(null),
  })
  .strict();

export const OcrCapabilitiesSchema = z
  .object({
    contract_version: ContractVersionSchema,
    engines: z.array(OcrEngineStatusSchema),
  })
  .strict();

export const OcrReadRequestSchema = z
  .object({
    contract_version: ContractVersionSchema.default(OCR_CONTRACT_VERSION),
    document_sha256: Sha256Schema,
    page_numbers: z.array(z.number().int().min(1)).min(1),
    engines: z.array(z.string().min(1)).min(1),
    /** Stated, never inferred from the document. */
    languages: z.array(z.string().min(1)).min(1),
    dpi: z.number().int().positive().max(1200).default(300),
  })
  .strict();

export type OcrReadRequest = z.infer<typeof OcrReadRequestSchema>;
export type OcrReadResponse = z.infer<typeof OcrReadResponseSchema>;
export type OcrPageReading = z.infer<typeof OcrPageReadingSchema>;
export type OcrCapabilities = z.infer<typeof OcrCapabilitiesSchema>;
export type OcrRefusal = z.infer<typeof OcrRefusalSchema>;
