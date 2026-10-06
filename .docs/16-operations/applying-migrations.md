# Applying migrations to production

Migrations reach Neon by hand, with the **direct owner** connection string (the host without
`-pooler`). Nothing in CI touches production. A release that needs a migration has the migration
applied first, so the code that ships never runs against a schema it doesn't know.

The credential stays in your terminal: it is read without echoing, used, and unset. It never goes
into the repository, a commit, a tool argument or a chat.

## The routine

From the repository, on the commit you are about to release:

```bash
read -rs 'DATABASE_URL?Production owner connection string (direct): '; echo; export DATABASE_URL

# 1. What would run. Read-only: it runs inside a READ ONLY transaction and writes nothing,
#    not even the bookkeeping table. A changed or unknown migration fails here, as it would
#    in a real run.
pnpm --filter @lokdarpan/database migrate -- --status

# 2. Apply. Each migration runs in its own transaction; one that fails rolls back alone
#    and stops the run, leaving the earlier ones applied.
pnpm --filter @lokdarpan/database migrate

# 3. Confirm nothing is pending, run the release's own checks (below), then:
pnpm --filter @lokdarpan/database migrate -- --status
unset DATABASE_URL
```

If step 1 lists anything other than what the release notes say, stop: the database and the
repository disagree, and finding out why comes first.

## 0040 – 0043 (Maharashtra notices and OCR, October 2026)

Production is expected to be at 0039: migrations 0037–0039 went in for the 1 October release.
Step 1 confirms it, and should list exactly:

```text
applied 39 of 43
pending 4:
  0040_an_artifact_remembers_how_it_was_found.sql
  0041_a_fact_names_the_field_it_fills.sql
  0042_a_page_read_by_an_engine_says_which.sql
  0043_a_fact_read_from_a_scan_names_the_reading.sql
```

| Migration | What it does to production                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| 0040      | New table `artifact_sighting` (how a notice was found on an agency's listing). Grants to `lokdarpan_etl`.                  |
| 0041      | Two `fact_kind` values (`tender_identifier`, `tender_date`); nullable `document_fact.field` with a format check.           |
| 0042      | New tables `page_reading` and `page_reading_item` (OCR readings, ADR-071). Grants to `lokdarpan_etl`.                      |
| 0043      | Nullable `document_fact.page_reading_id`; **replaces the `published_fact` view**, same columns, one more filter (ADR-072). |

All four are additive. None rewrites or validates an existing row against a new rule, so none
depends on what production holds. They were rehearsed on 6 October 2026 against a fresh database
migrated 0001 → 0043 in order, and `--status` was checked at both 0039 and 0043.

**The one change the live site can see is 0043's view.** `CREATE OR REPLACE VIEW` keeps the
grant `lokdarpan_api` reads it through, and its columns are unchanged, so the site's queries are
unaffected. It now leaves out facts read from a scan. Production holds none, so what the site shows
does not change.

The nightly tender job (`ingest:gepnic`) uses none of these objects, so it runs the same before
and after. The rule is still migrations first, release second.

After step 2, with `DATABASE_URL` still set, these read-only checks should each print `t`:

```bash
psql "$DATABASE_URL" -At \
  -c "SELECT count(*) = 43 FROM schema_migration" \
  -c "SELECT pg_get_viewdef('published_fact') ~ 'page_reading_id IS NULL'" \
  -c "SELECT has_table_privilege('lokdarpan_api', 'published_fact', 'SELECT')" \
  -c "SELECT has_table_privilege('lokdarpan_etl', 'page_reading', 'INSERT')" \
  -c "SELECT NOT EXISTS (SELECT 1 FROM document_fact WHERE page_reading_id IS NOT NULL)"
```

Then release `development` to `main` as usual. After the deploy, the homepage and `/api/v1/units`
should answer as before.

## 0044 (scan facts shown, October 2026)

After 0040–0043, step 1 should list only
`0044_a_fact_read_from_a_scan_says_how_legible_it_was.sql`. It adds a nullable
`document_fact.reading_confidence` and replaces `published_fact` again. The existing columns are
unchanged, and three new ones come last: `reading_engine`, `reading_engine_version` and
`reading_confidence`. The grant `lokdarpan_api` reads through is kept. Production holds no scan
facts, so nothing the site shows changes. Its checks:

```bash
psql "$DATABASE_URL" -At \
  -c "SELECT count(*) = 44 FROM schema_migration" \
  -c "SELECT pg_get_viewdef('published_fact') ~ 'reading_confidence IS NOT NULL'" \
  -c "SELECT has_table_privilege('lokdarpan_api', 'published_fact', 'SELECT')"
```
