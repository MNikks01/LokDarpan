export * from "./primitives";
export * from "./finance";

import { z } from "zod";
export const EnvelopeMetaSchema = z.object({
  datasetVersion: z.number().int(),
  asOf: z.string().datetime({ offset: true }),
});
export type EnvelopeMeta = z.infer<typeof EnvelopeMetaSchema>;
