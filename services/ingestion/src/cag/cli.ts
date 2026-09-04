import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { openDatasetVersion, recordArtifact, sealDatasetVersion } from "../lgd/load";
import { putArtifact } from "../raw-store";
import { CagClient, MAHARASHTRA_STATE_ID } from "./client";
import { extractDocument } from "./extract";
import { loadDocument } from "./load";

const RAW_ROOT =
  process.env["RAW_STORE_ROOT"] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/raw");

/** These are multi-megabyte documents from one government host. */
const POLITE_DELAY_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

/** `--state=Madhya Pradesh`. Rejoins on "=" so a value may contain one. */
function arg(name: string): string | undefined {
  return process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const limit = Number(process.argv[2] ?? "3");
  const client = new CagClient();

  // `--state="Madhya Pradesh"`, spelled as the CAG filter spells it. The id is
  // looked up from the page rather than held here, and an unrecognised name
  // lists what is on offer instead of silently fetching the default state's
  // reports under another state's name.
  const wanted = arg("state");
  let stateId = MAHARASHTRA_STATE_ID;
  let stateName = "Maharashtra";
  if (wanted !== undefined) {
    const states = await client.listStates();
    const match = states.find((s) => s.name.toLowerCase() === wanted.toLowerCase());
    if (match === undefined) {
      process.stderr.write(
        `The CAG filter offers no state called "${wanted}". It offers:\n` +
          states.map((s) => `  ${s.name}`).join("\n") +
          "\n",
      );
      process.exit(64);
    }
    stateId = match.id;
    stateName = match.name;
  }

  const reports = await client.listStateReports(stateId);
  process.stdout.write(`discovered ${String(reports.length)} ${stateName} reports\n`);

  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    // Matched by name rather than by a hard-coded LGD code, so adding a state
    // needs no second lookup table to keep in step. A document whose state is
    // not in `admin_unit` still loads, with a null unit and a warning — the
    // report is real whether or not the hierarchy has caught up with it.
    const state = await db.query<{ id: string }>(
      `SELECT id FROM admin_unit WHERE level = 'state' AND lower(name_en) = lower($1)`,
      [stateName],
    );
    const adminUnitId = state.rows[0] === undefined ? null : Number(state.rows[0].id);
    if (adminUnitId === null) {
      process.stdout.write(`no admin_unit for "${stateName}" — documents will load without one.\n`);
    }

    // Which reports we already hold, by the URL they were retrieved from.
    //
    // `loadDocument` is idempotent on the artefact's sha256, so re-ingesting is
    // harmless to the database — but it is not harmless to the publisher. These
    // are multi-megabyte PDFs on one government host, and re-downloading a
    // document we already hold in order to compute a hash we already know is
    // exactly the traffic `.docs/17-legal` §Data-sourcing ethics asks us not to
    // generate. `--refetch` is how to ask for it deliberately — when a report
    // has been revised in place, its bytes change and its sha256 with them.
    const held = await db.query(`SELECT source_url FROM source_artifact WHERE source_id = 'cag'`);
    const alreadyHeld = new Set((held.rows as { source_url: string }[]).map((r) => r.source_url));
    const refetch = process.argv.includes("--refetch");

    for (const report of reports.slice(0, limit)) {
      if (!refetch && alreadyHeld.has(report.url)) {
        process.stdout.write(
          `${report.title.slice(0, 52).padEnd(52)} already held, not refetched\n`,
        );
        continue;
      }

      const fetched = await client.fetchReport(report.url);

      // Original bytes stored before anything is parsed. Re-extraction with a
      // better parser must stay possible from what was actually retrieved.
      const artifact = await putArtifact(RAW_ROOT, fetched.body, {
        sourceId: "cag",
        sourceUrl: fetched.url,
        retrievedAt: new Date(),
        httpStatus: fetched.status,
        contentType: fetched.contentType,
      });

      const extracted = await extractDocument(fetched.body);
      await recordArtifact(db, artifact);
      const datasetVersionId = await openDatasetVersion(
        db,
        `CAG ${report.title} · ${artifact.sha256}`,
      );
      const result = await loadDocument(db, {
        artifact,
        extracted,
        meta: {
          docType: "audit_report",
          title: report.title,
          issuingAuthority: "Comptroller and Auditor General of India",
          // The listing does not state a publication date, and the retrieval
          // date is not one.
          publishedOn: null,
          adminUnitId,
        },
        datasetVersionId,
      });
      await sealDatasetVersion(db, datasetVersionId);

      process.stdout.write(
        `${report.title.slice(0, 52).padEnd(52)} ` +
          `pages=${String(result.pages)} no-text=${String(result.pagesWithoutText)}\n`,
      );
      await sleep(POLITE_DELAY_MS);
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
