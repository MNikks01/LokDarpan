import { z } from "zod";
import { AmountSchema, FigureSchema, ScoreConfidenceSchema } from "./primitives";

/**
 * BOTH variances, always, each explicitly named.
 * Audit C1: docs/05 comments `variance` as "released − utilized (or allocated −
 * utilized, per context)" while docs/06 defines them as two different
 * quantities. A field named `variance` MUST NOT exist — a mislabelled variance
 * is a neutrality failure, not merely a bug.
 */
export const FinanceChainSchema = z
  .object({
    allocated: FigureSchema,
    released: FigureSchema,
    utilized: FigureSchema,

    releaseVarianceInr: AmountSchema.nullable(),
    releaseDeviationPct: z.number().nullable(),

    allocationVarianceInr: AmountSchema.nullable(),
    allocationDeviationPct: z.number().nullable(),

    status: z.enum(["consistent", "needs_verification", "insufficient_data"]),
    thresholdPct: z.number().nullable(),
  })
  .strict()
  .refine(
    (f) => !("variance" in f),
    { message: "a bare `variance` field is forbidden — name which subtraction it is (audit C1)" },
  )
  .refine(
    (f) => f.status !== "insufficient_data" ||
           (f.releaseVarianceInr === null && f.allocationVarianceInr === null),
    { message: "no variance may be computed across a missing stage (docs/06 §2)" },
  );
export type FinanceChain = z.infer<typeof FinanceChainSchema>;

/** Verification Priority — never "risk", never renderable without its factors. */
export const VerificationPrioritySchema = z.object({
  score: z.number().int().min(0).max(100),
  band: z.enum(["low", "medium", "high", "very_high"]),
  scoreConfidence: ScoreConfidenceSchema,
  weightsVersion: z.string().min(1),
  factors: z
    .array(
      z.object({
        key: z.string(),
        weight: z.number(),
        factorScore: z.number(),
        contribution: z.number(),
        note: z.string(),
      }),
    )
    .min(1, "a score without its factor breakdown must never be rendered (docs/07)"),
});
export type VerificationPriority = z.infer<typeof VerificationPrioritySchema>;
