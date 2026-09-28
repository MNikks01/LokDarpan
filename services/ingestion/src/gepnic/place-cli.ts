import { parseArgs } from "node:util";
import pg from "pg";

import { decidePlacement, PlacementRefused, type Decision } from "./place.js";

/**
 * Record a reviewer's decision about a tender no rule could place.
 *
 *   DATABASE_URL=<reviewer> pnpm --filter @lokdarpan/ingestion tenders:place -- \
 *     --portal manipur --tender <portal tender id> --district 256 \
 *     --by "<your name>" --reason "Chain names Imphal West Division, Lamphel"
 *
 *   … --cannot-place --by "<your name>" --reason "State-level office; no district named"
 *
 * `tenders:resolve` prints the review list: each unplaced tender with the
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

function decisionFromArgs(): Decision {
  const { values } = parseArgs({
    options: {
      portal: { type: "string" },
      tender: { type: "string" },
      district: { type: "string" },
      "cannot-place": { type: "boolean" },
      by: { type: "string" },
      reason: { type: "string" },
    },
  });
  const { portal, tender, district, by, reason } = values;
  const cannotPlace = values["cannot-place"] === true;
  if (portal === undefined || tender === undefined) usage();
  if (by === undefined || reason === undefined) usage();
  if ((district === undefined) === !cannotPlace) usage();
  return {
    portalCode: portal,
    portalTenderId: tender,
    districtLgdCode: cannotPlace ? null : (district ?? null),
    decidedBy: by,
    reason,
  };
}

async function main(): Promise<void> {
  const decision = decisionFromArgs();
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78); // EX_CONFIG
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const decided = await decidePlacement(db, decision);
    process.stdout.write(
      decided.districtName === null
        ? `decision ${String(decided.decisionId)}: recorded as cannot be placed\n`
        : `decision ${String(decided.decisionId)}: placed in ${decided.districtName}\n`,
    );
  } catch (error: unknown) {
    if (!(error instanceof PlacementRefused)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 65; // EX_DATAERR
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
