import "server-only";

import type { CorrectionInput } from "@lokdarpan/domain";
import pg from "pg";

/**
 * The correction form's only connection to the database (ADR-075).
 *
 * It connects as `lokdarpan_intake`, which may execute `submit_correction` and
 * nothing else (migration 0046) — never as the read-only API user, and never as
 * the owner. A credential that can only submit cannot be turned into one that
 * reads or writes the ledger, whatever a request contains.
 */

export type SubmitOutcome =
  | { readonly kind: "received"; readonly reference: string }
  /** The site-wide hourly ceiling was reached; nothing was stored. */
  | { readonly kind: "paused" }
  /** No intake credential is configured in this environment. */
  | { readonly kind: "unavailable" };

let intakePool: pg.Pool | undefined;

function pool(url: string): pg.Pool {
  intakePool ??= new pg.Pool({ connectionString: url, max: 1, idleTimeoutMillis: 5_000 });
  return intakePool;
}

/** Postgres raises the ceiling with this hint (0046). */
const PAUSED_HINT = "intake_paused";

export async function submitCorrection(
  correction: CorrectionInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<SubmitOutcome> {
  const url = env["DATABASE_URL_INTAKE"];
  if (url === undefined || url === "") return { kind: "unavailable" };
  try {
    const r = await pool(url).query<{ reference: string }>(
      `SELECT submit_correction($1, $2::correction_category, $3, $4) AS reference`,
      [correction.subject, correction.category, correction.description, correction.evidenceUrl],
    );
    const reference = r.rows[0]?.reference;
    if (reference === undefined) throw new Error("submit_correction returned no reference");
    return { kind: "received", reference };
  } catch (error) {
    if ((error as { hint?: string } | null)?.hint === PAUSED_HINT) return { kind: "paused" };
    throw error;
  }
}
