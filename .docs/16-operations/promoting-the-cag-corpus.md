# Promoting the CAG corpus to production

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
- [ ] PR #152 is released and migration 0037 is applied (`raw-store.md` §3). The tool refuses to
      run if the two databases are on different migrations.
- [ ] Your local database holds the reviewed corpus: `SELECT count(*) FROM published_fact` should
      match the figure you expect (5,088 on 30 September 2026).

## Run it

In your own terminal, from the repository. The production string is the **direct owner** connection
(no `-pooler`), because the read-only and ETL roles cannot write documents. Nothing here is written
to a file.

```bash
export SOURCE_DATABASE_URL='postgresql://lokdarpan:lokdarpan_local_only@localhost:5433/lokdarpan'
read -rs 'TARGET_DATABASE_URL?Production owner connection string: '; echo; export TARGET_DATABASE_URL

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

## Later reviews

The promotion copies a report once. Decisions made locally after that do not follow it. Re-promoting
a report means removing it first (above) and running again, which gives its figures new ids. Nothing
outside the document tables refers to those ids today; check that is still true before doing it.
