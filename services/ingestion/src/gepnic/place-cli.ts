import { parseArgs } from "node:util";
import pg from "pg";

import { decidePlacement, PlacementRefused, type Decision } from "./place.js";
import { cliArgs } from "../cli-args.js";

/**
 * Record a reviewer's decision about a tender no rule could place.
 *
 *   DATABASE_URL=<reviewer> pnpm --filter @lokdarpan/ingestion tenders:place -- \
 *     --portal manipur --tender <portal tender id> --district 256 \
 *     --by "<your name>" --reason "Chain names Imphal West Division, Lamphel"
 *
 *   … --cannot-place --by "<your name>" --reason "State-level office; no district named"
 *
 * `--tender` may be given several times: each tender gets its own decision,
 * with the same district, reviewer and reason — for a group `tenders:review`
 * showed to share an answer.
 *
 * `tenders:review` prints the review list: each unplaced tender with the
 * chain, location and pincode a person needs. The district is given by its LGD
 * code and must belong to the tender's own state. Run it as a user granted
 * `lokdarpan_reviewer` (migration 0035): it can record decisions and set a
 * placement, and nothing else.
 */
function usage(): never {
  process.stderr.write(
    "Needs --portal, --tender, --by, --reason, and exactly one of --district or --cannot-place.\n",
  );
  process.exit(64); // EX_USAGE
}

/** One decision per tender named; they share the district, the reviewer and the reason. */
function decisionsFromArgs(): Decision[] {
  const { values } = parseArgs({
    args: cliArgs(),
    options: {
      portal: { type: "string" },
      tender: { type: "string", multiple: true },
      district: { type: "string" },
      "cannot-place": { type: "boolean" },
      by: { type: "string" },
      reason: { type: "string" },
    },
  });
  const { portal, tender, district, by, reason } = values;
  const cannotPlace = values["cannot-place"] === true;
  if (portal === undefined || tender === undefined || tender.length === 0) usage();
  if (by === undefined || reason === undefined) usage();
  if ((district === undefined) === !cannotPlace) usage();
  return tender.map((portalTenderId) => ({
    portalCode: portal,
    portalTenderId,
    districtLgdCode: cannotPlace ? null : (district ?? null),
    decidedBy: by,
    reason,
  }));
}

/**
 * Each tender is its own decision, in its own transaction: one refused (not in
 * this state, already placed) is reported and the rest still recorded.
 */
async function decideEach(db: pg.Client, decisions: readonly Decision[]): Promise<number> {
  let refused = 0;
  for (const decision of decisions) {
    try {
      const decided = await decidePlacement(db, decision);
      process.stdout.write(
        `${decision.portalTenderId}: decision ${String(decided.decisionId)}, ` +
          `${decided.districtName === null ? "cannot be placed" : `placed in ${decided.districtName}`}\n`,
      );
    } catch (error: unknown) {
      if (!(error instanceof PlacementRefused)) throw error;
      refused++;
      process.stderr.write(`${decision.portalTenderId}: refused — ${error.message}\n`);
    }
  }
  return refused;
}

async function main(): Promise<void> {
  const decisions = decisionsFromArgs();
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78); // EX_CONFIG
  }
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    if ((await decideEach(db, decisions)) > 0) process.exitCode = 65; // EX_DATAERR
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
