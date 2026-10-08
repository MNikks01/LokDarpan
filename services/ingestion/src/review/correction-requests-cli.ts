import pg from "pg";

import { DECISIONS, decideRequest, openRequests, type Decision } from "./correction-requests";

/**
 * Work through reports of data errors (ADR-075). Connects as the reviewer, who
 * may change a report's decision columns and nothing else.
 *
 *   pnpm --filter @lokdarpan/ingestion corrections:review
 *   pnpm --filter @lokdarpan/ingestion corrections:review -- \
 *     --decide=LD-0123456789 --status=no_change --reviewer=you@example \
 *     --note="Re-read page 12; the ledger matches it."
 */
const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL_REVIEWER"] ?? process.env["DATABASE_URL"];
  if (url === undefined || url === "") {
    process.stderr.write("DATABASE_URL_REVIEWER (or DATABASE_URL) is not set.\n");
    process.exit(78);
  }
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const reference = arg("decide");
    if (reference === undefined) {
      const open = await openRequests(db);
      process.stdout.write(`${String(open.length)} open report(s)\n\n`);
      for (const r of open) {
        process.stdout.write(
          `${r.reference}  ${r.receivedAt.slice(0, 16)}  ${r.status}\n` +
            `  about:    ${r.subject}\n  category: ${r.category}\n` +
            `  ${r.description.replace(/\s+/gu, " ")}\n` +
            (r.evidenceUrl === null ? "" : `  evidence: ${r.evidenceUrl}\n`) +
            "\n",
        );
      }
      return;
    }
    const status = arg("status");
    if (status === undefined || !(DECISIONS as readonly string[]).includes(status)) {
      process.stderr.write(`--status must be one of: ${DECISIONS.join(", ")}\n`);
      process.exit(64);
    }
    const found = await decideRequest(db, {
      reference,
      status: status as Decision,
      reviewer: arg("reviewer") ?? "",
      note: arg("note") ?? null,
    });
    process.stdout.write(found ? `${reference}: ${status}\n` : `${reference}: no such report\n`);
  } finally {
    await db.end();
  }
}

void main();
