import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import pg from "pg";

import {
  describeHint,
  districtIndex,
  groupForReview,
  reviewCsv,
  unplacedForReview,
  type ReviewGroup,
} from "./review.js";
import { cliArgs } from "../cli-args.js";

/**
 * The review list, grouped by issuing office, with what each group names.
 *
 *   DATABASE_URL=<reviewer, ETL or owner> pnpm --filter @lokdarpan/ingestion tenders:review
 *   … tenders:review -- --state 16                 one state, by LGD code
 *   … tenders:review -- --csv ~/review.csv         every tender, for a spreadsheet
 *
 * Read-only. A group's hint is what its tenders' own text names; deciding is a
 * person's act, recorded with `tenders:place` (several `--tender` ids may share
 * one decision). Runbook: `.docs/16-operations/tender-placement.md`.
 */
const SHOWN_PER_STATE = 12;
const IDS_PER_GROUP = 6;

function printGroup(group: ReviewGroup): void {
  const places = [...group.locations.slice(0, 3), ...group.pincodes.slice(0, 2)].join(" · ");
  const ids = group.tenders.slice(0, IDS_PER_GROUP).map((t) => t.portalTenderId);
  const more = group.tenders.length > IDS_PER_GROUP ? " …" : "";
  process.stdout.write(
    `  [${String(group.tenders.length).padStart(3)}] ${group.office}\n` +
      `        ${describeHint(group.hint)}${places === "" ? "" : ` — ${places}`}\n` +
      `        portal ${group.tenders[0]?.portalCode ?? "?"}: ${ids.join(" ")}${more}\n`,
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: cliArgs(),
    options: { state: { type: "string" }, csv: { type: "string" } },
  });
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78); // EX_CONFIG
  }
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const states = await db.query<{ state_lgd_code: string; name_en: string }>(
      `SELECT DISTINCT w.state_lgd_code, s.name_en
         FROM tender_collection_window w
         JOIN admin_unit s ON s.level = 'state' AND s.lgd_code = w.state_lgd_code
        WHERE $1::text IS NULL OR w.state_lgd_code = $1
        ORDER BY s.name_en`,
      [values.state ?? null],
    );
    const csv: string[] = [];
    let total = 0;
    for (const state of states.rows) {
      const districts = await districtIndex(db, state.state_lgd_code);
      const groups = groupForReview(await unplacedForReview(db, state.state_lgd_code), districts);
      const count = groups.reduce((sum, g) => sum + g.tenders.length, 0);
      if (count === 0) continue;
      total += count;
      process.stdout.write(
        `\n${state.name_en} (LGD ${state.state_lgd_code}) · ${String(count)} to review in ${String(groups.length)} groups\n`,
      );
      groups.slice(0, SHOWN_PER_STATE).forEach(printGroup);
      if (groups.length > SHOWN_PER_STATE) {
        process.stdout.write(`  … ${String(groups.length - SHOWN_PER_STATE)} smaller groups\n`);
      }
      const rows = reviewCsv(state.name_en, groups, districts).split("\n");
      csv.push(...(csv.length === 0 ? rows : rows.slice(1)).filter((r) => r !== ""));
    }
    process.stdout.write(`\n${String(total)} tenders to review\n`);
    if (values.csv !== undefined) {
      await writeFile(values.csv, `${csv.join("\n")}\n`, "utf8");
      process.stdout.write(`wrote ${values.csv}\n`);
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
