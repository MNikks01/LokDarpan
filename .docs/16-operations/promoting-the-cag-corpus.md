# Promoting the CAG corpus to production

> **Done · 6 October 2026.** Promoted as dataset version **285**: 30 reports · 6,339 pages · 10,712
> figures, 5,088 published · 260 review-history rows, matching the dry run exactly. Checked live:
> `/api/v1/documents` serves 30 documents and 5,088 published facts. The undo below names version 285.

**Written:** 30 September 2026 · **Decision:** [ADR-070](../adr/070-the-reviewed-ledger-is-copied-not-re-derived.md) · **Code:** `services/ingestion/src/cag/promote.ts`

The audit reports and every figure a person reviewed live in the local database, where the review
is done. Production has none of them. `promote:cag` copies them across: the report bytes to R2, and
the documents, pages, figures and review history to Neon, in one transaction checked against the
source before it commits.

## What it carries, and what it does not

| Carried                                           | Not carried                                              |
| ------------------------------------------------- | -------------------------------------------------------- |
| Each report's bytes, to the R2 bucket             | `document_text_item` (361 MB of per-word page positions) |
| Documents, filed under the target's own state ids | Anything not from the `cag` source                       |
| Every page's text                                 | A report the target already holds (left untouched)       |
| Every figure, reviewed or not, with its decision  |                                                          |
| Who decided each figure, when, and its rectangle  |                                                          |
| Same-figure links between Hindi and English pages |                                                          |
| The review history of superseded decisions        |                                                          |

A reader loses nothing from the omission: each published figure carries its own rectangle. What
stays local is what the extractor needs to find figures, and extraction and review stay local too.

## Before you run it

- [ ] Neon is serving connections again. The transfer quota reset at 00:00 UTC on 1 October 2026.
- [ ] Both databases are on the same migrations: `migrate -- --status` shows nothing pending on
      either (`applying-migrations.md`). The tool refuses to run if they differ. On 6 October 2026
      both were at 0044.
- [ ] Your local database holds the reviewed corpus: `SELECT count(*) FROM published_fact` should
      match the figure you expect (5,088 on 30 September 2026).

## Run it

In your own terminal, from the repository. The production string is the **direct owner** connection
(no `-pooler`), because the read-only and ETL roles cannot write documents. Nothing here is written
to a file.

```bash
export SOURCE_DATABASE_URL='postgresql://lokdarpan:lokdarpan_local_only@localhost:5433/lokdarpan'
read -rs 'TARGET_DATABASE_URL?Production owner connection string: '; echo; export TARGET_DATABASE_URL

# Your Cloudflare account's R2 endpoint (R2 → bucket → Settings → S3 API). Replace the whole
# placeholder: left as written it fails with "Invalid URL" before anything is written.
export RAW_STORE_S3_ENDPOINT='https://<account id>.r2.cloudflarestorage.com'
export RAW_STORE_S3_BUCKET='lokdarpan-raw'
read -rs 'RAW_STORE_S3_ACCESS_KEY_ID?R2 access key ID: '; echo; export RAW_STORE_S3_ACCESS_KEY_ID
read -rs 'RAW_STORE_S3_SECRET_ACCESS_KEY?R2 secret: '; echo; export RAW_STORE_S3_SECRET_ACCESS_KEY

# 1. Dry run: does everything, checks every count, rolls back.
pnpm --filter @lokdarpan/ingestion promote:cag

# 2. Only if the dry run printed the numbers below:
pnpm --filter @lokdarpan/ingestion promote:cag --commit
```

**Expected** (the rehearsal of 30 September 2026, into a copy of production's shape):

```
raw store: s3://lokdarpan-raw
30 report(s) · 6339 pages · 10712 figures, 5088 published · 260 review-history rows
Committed as dataset version <n>.
```

It takes about ten seconds locally; across the network to Neon, expect a minute or two. The
database grows by about 54 MB.

| Exit | Meaning                                                                       |
| ---: | ----------------------------------------------------------------------------- |
|    0 | Done, or a dry run completed                                                  |
|   64 | Bad arguments, or source and target are the same database                     |
|   65 | Refused before writing: migrations differ, a place is missing, bytes mismatch |
|   78 | A connection string or the R2 variables are not set                           |
|    1 | Anything else; the transaction was rolled back                                |

## Check it

```sql
SELECT stored_in, count(*) FROM source_artifact WHERE source_id = 'cag' GROUP BY 1;  -- s3://lokdarpan-raw | 30
SELECT count(*) FROM published_fact;                                                  -- 5088
```

Then open `/documents` on the live site. API answers are cached at the CDN for up to an hour
(PR #154), so a page read before the promotion may show the old, empty list until then.

## Undo

Every promoted row hangs off one dataset version, whose description begins "CAG corpus promoted".
Deleting its documents removes their pages, figures and history by cascade:

```sql
BEGIN;
DELETE FROM document WHERE dataset_version_id = <n>;
-- check the counts above are back to zero, then:
COMMIT;
```

The artefact rows and the bytes in R2 stay. They are content-addressed and harmless, and a later
promotion reuses them.

## Later reviews (`--refresh`, #190)

The promotion copies a report once. Review continues afterwards — a newer parser adds candidates, a
reviewer decides them or revises an earlier decision — and `--refresh` carries that work into
production for reports both databases hold:

```bash
# Same environment as above. Dry run first:
pnpm --filter @lokdarpan/ingestion promote:cag -- --refresh
# Only if the dry run's numbers are what you expect:
pnpm --filter @lokdarpan/ingestion promote:cag -- --refresh --commit
```

It prints how many reports differed, and for those: figures added, decisions updated, undecided
candidates retired, history rows carried and same-figure links set. Every figure keeps its
production id; nothing a reader may have linked to is renumbered.

- **Matching.** A figure is found in production by its identity (page, kind, the words it was read
  from, its value and field). Figures identical in all five are matched in id order.
- **Decisions are never deleted.** A decided production figure the source no longer produces is kept
  and counted as `stranded`; only undecided candidates are retired.
- **History is copied, not regenerated.** The review-history trigger is disabled inside the
  transaction while decisions are copied, and re-enabled before it commits.
- **Self-check.** After applying, it plans again and refuses to commit unless nothing is left to do.
- **Not carried:** figures read from scans, since page readings are not promoted. They are counted.
- **Refused:** a report whose page count differs between the databases (it was re-read and needs
  removing and promoting again), or two databases on different migrations.

Then, if bodies changed, run `ingest:bodies` against production
([`reviewing-public-bodies.md`](reviewing-public-bodies.md)).
