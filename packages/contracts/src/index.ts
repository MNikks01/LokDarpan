export * from "./primitives";
export * from "./finance";
export * from "./ocr";

import { z } from "zod";
export const EnvelopeMetaSchema = z.object({
  /** The ledger state the payload was read from (.docs/adr/053). `0` only for an empty ledger. */
  datasetVersion: z.number().int().nonnegative(),
  /** When that version was opened — never the time of the response. `null` only with version `0`. */
  asOf: z.string().datetime({ offset: true }).nullable(),
});
export type EnvelopeMeta = z.infer<typeof EnvelopeMetaSchema>;
