import pg from "pg";
import { parseRelations } from "./boundaries";
import type { OverpassRelation } from "./boundaries";
import { loadBoundaries } from "./load";
import { boundariesInRelationQuery, readElements, runQuery } from "./overpass";

/**
 * Ingest the administrative boundaries inside one OSM relation.
 *
 *   ingest:osm-boundaries --relation=1991091 --parent=20
 *
 * Scoped to one relation on purpose. Overpass is a shared volunteer service and
 * a state-wide query is both slow and rude; a district at a time is the unit an
 * operator can check the output of.
 */
function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

interface Options {
  readonly connectionString: string;
  readonly relationId: number;
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
  const relationArg = arg("relation");
  const relationId = relationArg === undefined ? Number.NaN : Number(relationArg);
  if (!Number.isInteger(relationId)) {
    process.stderr.write("--relation=<osm relation id> is required.\n");
    process.exit(64);
  }
  const parentArg = arg("parent");
  const parsedParent = parentArg === undefined ? null : Number(parentArg);
  return {
    connectionString,
    relationId,
    parentId: parsedParent !== null && Number.isInteger(parsedParent) ? parsedParent : null,
    levels: (arg("levels") ?? "")
      .split(",")
      .map((l) => Number(l.trim()))
      .filter((l) => Number.isInteger(l)),
  };
}

async function main(): Promise<void> {
  const { connectionString, relationId, parentId, levels } = options();

  process.stdout.write(
    `Querying Overpass for boundaries inside relation ${String(relationId)}` +
      (levels.length === 0 ? " (all levels)" : ` at admin_level ${levels.join(", ")}`) +
      " …\n",
  );
  const artifact = await runQuery(boundariesInRelationQuery(relationId, levels));
  const elements = readElements(artifact);
  process.stdout.write(
    `  ${String(elements.length)} elements, sha256 ${artifact.sha256.slice(0, 12)}…\n`,
  );

  const { units, rejected } = parseRelations(elements as readonly OverpassRelation[]);
  process.stdout.write(`  ${String(units.length)} usable, ${String(rejected.length)} rejected\n`);
  for (const r of rejected.slice(0, 10)) {
    process.stdout.write(`    relation/${String(r.osmRelationId)}: ${r.reason}\n`);
  }

  if (units.length === 0) {
    process.stdout.write("Nothing to load.\n");
    return;
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const result = await loadBoundaries(db, {
      units,
      artifact,
      parentId: parentId !== null && Number.isInteger(parentId) ? parentId : null,
      datasetDescription: `OSM administrative boundaries inside relation ${String(relationId)}`,
    });
    process.stdout.write(
      `\n${String(result.inserted)} inserted, ${String(result.updated)} updated, ${String(result.failed.length)} failed\n`,
    );
    for (const f of result.failed.slice(0, 10)) {
      process.stdout.write(`  relation/${String(f.osmRelationId)}: ${f.reason}\n`);
    }
    const byLevel = new Map<string, number>();
    for (const u of units) byLevel.set(u.level, (byLevel.get(u.level) ?? 0) + 1);
    process.stdout.write("\nBy level:\n");
    for (const [level, n] of [...byLevel].sort()) {
      process.stdout.write(`  ${level.padEnd(18)} ${String(n)}\n`);
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
