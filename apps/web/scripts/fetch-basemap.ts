#!/usr/bin/env tsx
/**
 * Build the self-hosted base map: an OpenStreetMap extract as a PMTiles archive.
 *
 * WHY THIS IS A SCRIPT AND NOT A COMMITTED ASSET
 * The archive is tens of megabytes and is derived data — regenerating it is a
 * command, and committing it would put a binary blob in the history that
 * changes every time OSM does. It is gitignored, like the boundary geometry,
 * and for the same reason.
 *
 * WHY SELF-HOSTED
 * No API key, no per-load bill, and no request from a reader's browser to a
 * commercial map vendor. `.docs/adr/006-maps.md` rejected Mapbox on exactly
 * that reasoning; a civic site's readers should not be logged by a map company
 * for looking at a public record.
 *
 * Run:
 *   pnpm --filter @lokdarpan/web geo:basemap -- --unit=3599
 *   pnpm --filter @lokdarpan/web geo:basemap -- --bbox=78.25,20.58,79.66,21.72 --name=nagpur
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Pinned. An unpinned release would change the tool under us between runs, and
 * the digest of what was fetched is recorded so a changed artefact is visible
 * rather than silently trusted — the project publishes no checksums of its own.
 */
const CLI_VERSION = "1.31.2";
const PLANET_BASE = "https://build.protomaps.com";

/** Detail beyond this is invisible at the zooms this map is read at, and costs. */
const DEFAULT_MAX_ZOOM = 14;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const toolsDir = join(repoRoot, "tools");
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "basemap");

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** The pmtiles CLI, downloaded once into a gitignored directory. */
async function ensureCli(): Promise<string> {
  const binary = join(toolsDir, "pmtiles");
  if (existsSync(binary)) return binary;

  const platform = process.platform === "darwin" ? "Darwin" : "Linux";
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  const archive = platform === "Darwin" ? "zip" : "tar.gz";
  const name = `go-pmtiles${platform === "Darwin" ? "-" : "_"}${CLI_VERSION}_${platform}_${arch}.${archive}`;
  const url = `https://github.com/protomaps/go-pmtiles/releases/download/v${CLI_VERSION}/${name}`;

  say(`Fetching the pmtiles CLI ${CLI_VERSION} for ${platform}/${arch} …`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not download ${url}: ${String(response.status)}`);
  const bytes = Buffer.from(await response.arrayBuffer());

  mkdirSync(toolsDir, { recursive: true });
  const archivePath = join(toolsDir, `pmtiles.${archive}`);
  writeFileSync(archivePath, bytes);
  say(`  sha256 ${createHash("sha256").update(bytes).digest("hex")}`);

  const unpack =
    archive === "zip"
      ? spawnSync("unzip", ["-oq", archivePath, "-d", toolsDir])
      : spawnSync("tar", ["-xzf", archivePath, "-C", toolsDir]);
  if (unpack.status !== 0) throw new Error("could not unpack the pmtiles CLI");
  chmodSync(binary, 0o755);
  return binary;
}

/** The most recent planet build the service still holds. */
async function latestPlanet(): Promise<string> {
  const today = new Date();
  for (let back = 0; back < 21; back++) {
    const day = new Date(today.getTime() - back * 86_400_000);
    const stamp = day.toISOString().slice(0, 10).replace(/-/g, "");
    const url = `${PLANET_BASE}/${stamp}.pmtiles`;
    const response = await fetch(url, { headers: { range: "bytes=0-10" } });
    if (response.ok || response.status === 206) return url;
  }
  throw new Error(
    `No planet build found in the last three weeks under ${PLANET_BASE}. Builds are rotated; check the URL scheme.`,
  );
}

/**
 * The extent to extract.
 *
 * `--unit` reads it from the ledger, so the region is defined by a boundary
 * already ingested rather than by numbers typed into a command. That is what
 * keeps this generic: any unit with a boundary can have a base map, and nothing
 * here knows what a district or a city is.
 */
async function resolveBbox(): Promise<{ bbox: string; name: string }> {
  const explicit = arg("bbox");
  if (explicit !== undefined) {
    if (!/^-?[\d.]+(,-?[\d.]+){3}$/.test(explicit)) {
      throw new Error("--bbox must be west,south,east,north");
    }
    return { bbox: explicit, name: arg("name") ?? "region" };
  }

  const unit = arg("unit");
  if (unit === undefined)
    throw new Error("Pass --unit=<ledger id> or --bbox=west,south,east,north");

  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    throw new Error("DATABASE_URL is not set, and --unit reads the extent from the ledger.");
  }
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const result = await db.query<{ bbox: string; name: string }>(
      `SELECT ST_XMin(b.geometry) || ',' || ST_YMin(b.geometry) || ',' ||
              ST_XMax(b.geometry) || ',' || ST_YMax(b.geometry) AS bbox,
              u.name_en AS name
         FROM admin_unit_boundary b JOIN admin_unit u ON u.id = b.admin_unit_id
        WHERE u.id = $1`,
      [Number(unit)],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error(`unit ${unit} has no boundary in the ledger`);
    return { bbox: row.bbox, name: arg("name") ?? slug(row.name) };
  } finally {
    await db.end();
  }
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main(): Promise<void> {
  const cli = await ensureCli();
  const { bbox, name } = await resolveBbox();
  const planet = await latestPlanet();
  const maxZoom = arg("maxzoom") ?? String(DEFAULT_MAX_ZOOM);

  mkdirSync(outDir, { recursive: true });
  const output = join(outDir, `${name}.pmtiles`);

  say(`Extracting ${name} from ${planet}`);
  say(`  bbox ${bbox}, max zoom ${maxZoom}`);
  const result = spawnSync(
    cli,
    ["extract", planet, output, `--bbox=${bbox}`, `--maxzoom=${maxZoom}`],
    {
      stdio: "inherit",
    },
  );
  if (result.status !== 0) throw new Error("pmtiles extract failed");

  const size = readFileSync(output).byteLength;
  say(`\n✓ ${output} — ${(size / 1e6).toFixed(1)} MB`);
  say(`  Set NEXT_PUBLIC_BASEMAP_URL=/basemap/${name}.pmtiles if this is not the default.`);
  say(`  © OpenStreetMap contributors, ODbL 1.0 — attribution is rendered on the map.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
