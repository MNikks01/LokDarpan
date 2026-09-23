import pg from "pg";
import { parseRelations } from "./boundaries";
import type { OverpassRelation } from "./boundaries";
import { loadBoundaries } from "./load";
import {
  OverpassDeclined,
  boundariesInRelationQuery,
  readElements,
  runQuery,
  waitForSlot,
} from "./overpass";

/**
 * Ingest the administrative boundaries inside one OSM relation.
 *
 *   ingest:osm-boundaries --relation=1991091 --parent=20
 *
 * Or every district of a state, one query each:
 *
 *   ingest:osm-boundaries --within=20 --levels=6,8
 *
 * Scoped to one relation on purpose. Overpass is a shared volunteer service and
 * a state-wide query is both slow and rude; a district at a time is the unit an
 * operator can check the output of. `--within` does not relax that — it is the
 * same per-district query, run for each district in turn with a pause between,
 * which is what `overpass.ts` describes as the way to ingest a state.
 *
 * It also settles parentage without having to compute it. A taluka found inside
 * Nagpur's relation is a taluka of Nagpur, so the parent is known from which
 * query returned the unit. Deriving it instead — by asking which district
 * polygon contains the shape — would be a second, weaker answer to a question
 * the query already answered exactly.
 */
function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

/**
 * How many times one district is re-attempted after Overpass declines it.
 *
 * The pause before each query comes from `waitForSlot`, which reads the
 * service's own status page. A fixed interval was tried first and is what this
 * replaced: ten seconds apart, the eighth district was refused with a 429,
 * because the limit is a small number of concurrent slots rather than a rate.
 */
const ATTEMPTS_PER_DISTRICT = 3;

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

interface Options {
  readonly connectionString: string;
  readonly relationId: number | null;
  readonly withinUnitId: number | null;
  readonly parentId: number | null;
  readonly levels: readonly number[];
}

/** Parsed arguments, or a message and exit code when they do not make sense. */
function options(): Options {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }
  const relationId = numeric(arg("relation"));
  const withinUnitId = numeric(arg("within"));
  if (relationId === null && withinUnitId === null) {
    process.stderr.write(
      "One of --relation=<osm relation id> or --within=<admin_unit id> is required.\n",
    );
    process.exit(64);
  }
  if (relationId !== null && withinUnitId !== null) {
    // Silently preferring one would make the other argument look honoured.
    process.stderr.write("--relation and --within cannot both be given.\n");
    process.exit(64);
  }
  return {
    connectionString,
    relationId,
    withinUnitId,
    parentId: numeric(arg("parent")),
    levels: (arg("levels") ?? "")
      .split(",")
      .map((l) => Number(l.trim()))
      .filter((l) => Number.isInteger(l)),
  };
}

function numeric(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

interface Ingested {
  readonly inserted: number;
  readonly updated: number;
  readonly failed: number;
  readonly byLevel: ReadonlyMap<string, number>;
}

/** One Overpass query, parsed and loaded under one parent. */
async function ingestRelation(
  db: pg.Client,
  relationId: number,
  parentId: number | null,
  levels: readonly number[],
): Promise<Ingested> {
  const artifact = await runQuery(boundariesInRelationQuery(relationId, levels));
  const elements = readElements(artifact);
  const { units, rejected } = parseRelations(elements as readonly OverpassRelation[]);
  process.stdout.write(
    `  ${String(elements.length)} elements, ${String(units.length)} usable, ` +
      `${String(rejected.length)} rejected, sha256 ${artifact.sha256.slice(0, 12)}…\n`,
  );
  for (const r of rejected.slice(0, 10)) {
    process.stdout.write(`    relation/${String(r.osmRelationId)}: ${r.reason}\n`);
  }

  const byLevel = new Map<string, number>();
  for (const u of units) byLevel.set(u.level, (byLevel.get(u.level) ?? 0) + 1);
  if (units.length === 0) return { inserted: 0, updated: 0, failed: 0, byLevel };

  const result = await loadBoundaries(db, {
    units,
    artifact,
    parentId,
    datasetDescription: `OSM administrative boundaries inside relation ${String(relationId)}`,
  });
  for (const f of result.failed.slice(0, 10)) {
    process.stdout.write(`    relation/${String(f.osmRelationId)}: ${f.reason}\n`);
  }
  return {
    inserted: result.inserted,
    updated: result.updated,
    failed: result.failed.length,
    byLevel,
  };
}

/**
 * One district, waiting for a slot before each attempt.
 *
 * Returns null when Overpass declined every attempt, which the caller records
 * rather than treats as an error: the district holds no sub-units from this
 * run, and the rest of the state is unaffected.
 */
async function ingestWithRetries(
  db: pg.Client,
  target: { readonly id: number | null; readonly name: string; readonly relationId: number },
  levels: readonly number[],
): Promise<Ingested | null> {
  for (let attempt = 1; attempt <= ATTEMPTS_PER_DISTRICT; attempt++) {
    await waitForSlot();
    try {
      return await ingestRelation(db, target.relationId, target.id, levels);
    } catch (error) {
      if (!(error instanceof OverpassDeclined)) throw error;
      process.stdout.write(
        `  ${error.message} (attempt ${String(attempt)} of ${String(ATTEMPTS_PER_DISTRICT)})\n`,
      );
      await sleep(60_000);
    }
  }
  return null;
}

/**
 * The children of a unit that can be queried — those OSM identified.
 *
 * A child without a relation id is not an error and not skipped silently: it is
 * reported, because it means that district's sub-units cannot be reached and a
 * reader would otherwise see an empty district that looks the same as one with
 * nothing in it.
 */
async function childrenToQuery(
  db: pg.Client,
  unitId: number,
): Promise<{
  readonly queryable: readonly { id: number; name: string; relationId: number }[];
  readonly unidentified: readonly string[];
}> {
  const rows = await db.query<{ id: string; name_en: string; osm_relation_id: string | null }>(
    `SELECT id, name_en, osm_relation_id FROM admin_unit WHERE parent_id = $1 ORDER BY name_en`,
    [unitId],
  );
  const queryable: { id: number; name: string; relationId: number }[] = [];
  const unidentified: string[] = [];
  for (const r of rows.rows) {
    if (r.osm_relation_id === null) unidentified.push(r.name_en);
    else
      queryable.push({ id: Number(r.id), name: r.name_en, relationId: Number(r.osm_relation_id) });
  }
  return { queryable, unidentified };
}

async function main(): Promise<void> {
  const { connectionString, relationId, withinUnitId, parentId, levels } = options();
  const levelNote = levels.length === 0 ? " (all levels)" : ` at admin_level ${levels.join(", ")}`;

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const totals = new Map<string, number>();
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    const targets =
      relationId !== null
        ? [{ id: parentId, name: `relation ${String(relationId)}`, relationId }]
        : await (async () => {
            const { queryable, unidentified } = await childrenToQuery(db, withinUnitId ?? 0);
            process.stdout.write(
              `${String(queryable.length)} children of unit ${String(withinUnitId)} carry an ` +
                `OSM relation and will be queried${levelNote}.\n`,
            );
            if (unidentified.length > 0) {
              process.stdout.write(
                `${String(unidentified.length)} carry none and cannot be queried: ` +
                  `${unidentified.slice(0, 8).join(", ")}\n`,
              );
            }
            return queryable.map((c) => ({ id: c.id, name: c.name, relationId: c.relationId }));
          })();

    // A district Overpass will not serve costs that district, not the state.
    // Losing 28 districts to the ninth one's refusal is what the first run did,
    // and the work already committed for the first eight was invisible in the
    // error it ended with.
    const declined: string[] = [];

    for (const target of targets) {
      process.stdout.write(`\n${target.name} (relation ${String(target.relationId)}) …\n`);
      const one = await ingestWithRetries(db, target, levels);
      if (one === null) {
        declined.push(target.name);
        continue;
      }
      inserted += one.inserted;
      updated += one.updated;
      failed += one.failed;
      for (const [level, n] of one.byLevel) totals.set(level, (totals.get(level) ?? 0) + n);
    }

    process.stdout.write(
      `\n${String(inserted)} inserted, ${String(updated)} updated, ${String(failed)} failed\n`,
    );
    process.stdout.write("By level:\n");
    for (const [level, n] of [...totals].sort()) {
      process.stdout.write(`  ${level.padEnd(18)} ${String(n)}\n`);
    }
    if (declined.length > 0) {
      // Named, not counted. Re-running is per district, and an operator cannot
      // do that from a number.
      process.stdout.write(
        `\n${String(declined.length)} district(s) were declined by Overpass and hold no ` +
          `sub-units from this run: ${declined.join(", ")}\n` +
          "Re-run the same command; districts already loaded are updated, not duplicated.\n",
      );
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
