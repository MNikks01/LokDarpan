import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pg from "pg";

import { openDatasetVersion, recordArtifact, sealDatasetVersion } from "../lgd/load.js";
import { putArtifact } from "../raw-store.js";
import { readDirectoryFromApi } from "./api.js";
import { replaceDirectory } from "./load.js";
import { parseApiRecords, parseDirectory, type ParsedDirectory } from "./parse.js";

/**
 * Load the Department of Posts pincode directory, by one of two routes.
 *
 * Through the API, with a key issued to a registered data.gov.in account:
 *
 *   DATABASE_URL=<owner> DATA_GOV_IN_API_KEY=<key> \
 *     pnpm --filter @lokdarpan/ingestion ingest:pincodes -- --api
 *
 * Or from a file a person downloaded in a browser:
 *
 *   DATABASE_URL=<owner> pnpm --filter @lokdarpan/ingestion ingest:pincodes -- \
 *     --file ~/Downloads/pincode.csv \
 *     --source-url https://www.data.gov.in/resource/<the resource page it came from> \
 *     --retrieved-at 2026-09-25T10:00:00Z
 *
 * WHY THESE TWO AND NO THIRD
 * `data.gov.in` serves `Disallow: /`, so no program here fetches its pages or
 * file downloads; the API is the sanctioned programmatic channel, and it needs
 * a key. A person downloading the file is not a crawler. For a file,
 * `--source-url` and `--retrieved-at` are required rather than defaulted: a
 * provenance record whose origin was guessed is worse than none. Either way the
 * exact bytes are stored, so every inferred district traces to them.
 */
const RAW_ROOT =
  process.env["RAW_STORE_ROOT"] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/raw");

interface Read {
  readonly bytes: Buffer;
  readonly parsed: ParsedDirectory;
  readonly sourceUrl: string;
  readonly when: Date;
  readonly viaApi: boolean;
}

function fail(code: number, message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

async function readThroughApi(): Promise<Read> {
  const apiKey = process.env["DATA_GOV_IN_API_KEY"];
  if (apiKey === undefined || apiKey === "") {
    fail(
      78,
      "DATA_GOV_IN_API_KEY is not set. Keys are issued to a registered data.gov.in account.",
    );
  }
  const when = new Date();
  const read = await readDirectoryFromApi({ apiKey });
  return {
    bytes: Buffer.from(read.raw, "utf8"),
    parsed: parseApiRecords(read.records),
    sourceUrl: read.sourceUrl,
    when,
    viaApi: true,
  };
}

async function readFromFile(values: {
  readonly file?: string | undefined;
  readonly "source-url"?: string | undefined;
  readonly "retrieved-at"?: string | undefined;
}): Promise<Read> {
  const file = values.file;
  const stated = values["source-url"];
  const retrievedAt = values["retrieved-at"];
  if (file === undefined || stated === undefined || retrievedAt === undefined) {
    fail(64, "Use --api, or all of --file, --source-url and --retrieved-at."); // EX_USAGE
  }
  if (!/^https:\/\/(www\.)?data\.gov\.in\//u.test(stated)) {
    fail(64, "--source-url must be the data.gov.in page the file came from.");
  }
  const when = new Date(retrievedAt);
  if (Number.isNaN(when.getTime())) fail(64, "--retrieved-at must be an ISO 8601 date and time.");
  const bytes = await readFile(file);
  return {
    bytes,
    parsed: parseDirectory(bytes.toString("utf8")),
    sourceUrl: stated,
    when,
    viaApi: false,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      api: { type: "boolean" },
      file: { type: "string" },
      "source-url": { type: "string" },
      "retrieved-at": { type: "string" },
    },
  });
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    fail(78, "DATABASE_URL is not set."); // EX_CONFIG
  }
  const { bytes, parsed, sourceUrl, when, viaApi } =
    values.api === true ? await readThroughApi() : await readFromFile(values);

  process.stdout.write(
    `parsed ${String(parsed.entries.length)} offices, rejected ${String(parsed.rejected.length)}\n`,
  );
  for (const r of parsed.rejected.slice(0, 5)) {
    process.stdout.write(`  line ${String(r.line)}: ${r.reason}\n`);
  }
  if (parsed.entries.length === 0) throw new Error("No office could be read. Nothing loaded.");

  const artifact = await putArtifact(RAW_ROOT, bytes, {
    sourceId: "pincode-directory",
    sourceUrl,
    retrievedAt: when,
    httpStatus: viaApi ? 200 : null,
    contentType: viaApi ? "application/json" : "text/csv",
  });

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    await recordArtifact(db, artifact);
    const version = await openDatasetVersion(
      db,
      `Department of Posts pincode directory · ${artifact.sha256}`,
    );
    const inserted = await replaceDirectory(db, {
      entries: parsed.entries,
      sourceSha256: artifact.sha256,
      datasetVersionId: version,
    });
    await sealDatasetVersion(db, version);
    process.stdout.write(
      `loaded ${String(inserted)} offices from ${artifact.sha256.slice(0, 12)}… ` +
        `(dataset_version ${String(version)})\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
