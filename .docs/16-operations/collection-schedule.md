# Collection schedule

**Updated:** 5 September 2026 · **Workflow:** [`.github/workflows/ingest-tenders.yml`](../../.github/workflows/ingest-tenders.yml) · **Related:** [`adr/048`](../adr/048-a-count-is-not-a-claim-about-the-world.md) (freshness), [`deployment-vercel.md`](./deployment-vercel.md)

## Schedule

|           |                                                                                   |
| --------- | --------------------------------------------------------------------------------- |
| Workflow  | **Ingest tenders**                                                                |
| Cron      | `0 20 * * *` — 20:00 UTC, **01:30 IST**, the quietest hour for the portals polled |
| Frequency | once daily                                                                        |
| Command   | `pnpm --filter @lokdarpan/ingestion ingest:gepnic --all`                          |
| Where     | GitHub Actions, `ubuntu-latest`, 45-minute timeout                                |

`--all` is required. Without it the CLI expects a single `--portal=` and exits 64.

**Why GitHub Actions.** The web tier is on Vercel and the database is Neon, and
[`deployment-vercel.md`](./deployment-vercel.md) §4 rules out running ETL from
Vercel — it needs a write credential, and that must not sit beside the public
site. Nothing else in this repository establishes a host, and Actions is the one
scheduler it already runs.

## Manual execution

**Actions → Ingest tenders → Run workflow.** That is `workflow_dispatch`, and it
is the only way to exercise the schedule without waiting a day.

By hand, against production, from a trusted machine:

```bash
DATABASE_URL='<ETL connection string>' \
  pnpm --filter @lokdarpan/ingestion ingest:gepnic --all
```

Safe to repeat. The upsert keys on the portal's own tender id, `first_seen_at` is
never rewritten, `collecting_since` is set once, and the history trigger records
a version only when a field the source controls actually changed. Two runs an
hour apart produce the same ledger as one.

## Credentials

|               |                                                             |
| ------------- | ----------------------------------------------------------- |
| GitHub secret | **`INGEST_DATABASE_URL`**                                   |
| Database role | `lokdarpan_etl` (group) via a login user, **not** the owner |
| Reaches       | one step of one workflow                                    |

The role may read `admin_unit` and `tender_version`, insert into
`source_artifact` and `dataset_version`, and read/insert/update `tender`,
`tender_collection_window` and `ingestion_run`. It cannot delete, truncate,
change the schema, create objects, write tender history directly, or touch the
audit ledger. Migration `0031` states each grant and why.

Create the production login user once, as owner:

```sql
CREATE ROLE lokdarpan_etl_prod LOGIN PASSWORD '<generated>';
GRANT lokdarpan_etl TO lokdarpan_etl_prod;
```

Then set `INGEST_DATABASE_URL` to that user's **pooled** Neon URL.

**Verify it is not the owner** before trusting it:

```sql
SELECT current_user, pg_has_role(current_user, 'lokdarpan', 'MEMBER') AS is_owner;
```

`is_owner` must be `false`. `packages/database/tests/etl-role.integration.test.ts`
asserts the same thing in CI.

**Rotation:** create a second login user, grant it `lokdarpan_etl`, update the
secret, run the workflow by hand, then drop the old user. The group role holds
the grants, so nothing else changes.

**Never** put this string in workflow YAML, a repository file, `.env`, a command
line, or a log. It is passed through the step's environment for exactly that
reason.

## Concurrency

Two guards, and only one of them is authoritative.

**PostgreSQL advisory lock — authoritative.** The sweep takes key **`437642`**
with `pg_try_advisory_lock` on the same connection it runs on, and never waits.
Session-scoped, so the server releases it when the connection ends — on a clean
exit, a crash, or a cancelled runner. There is no stale lock to clear and no
timeout to tune. A second sweep that cannot take it records an `ingestion_run`
with status `skipped`, naming the backend holding it, and exits **75**.

Who holds it right now:

```sql
SELECT pid, granted FROM pg_locks WHERE locktype = 'advisory' AND objid = 437642;
SELECT pid, state, query_start FROM pg_stat_activity WHERE pid = <pid>;
```

**GitHub concurrency — a courtesy.** The group `ingest-gepnic` with
`cancel-in-progress: false` stops two workflow runs starting together.
Cancelling is deliberately off: it would kill a sweep that is working. Note that
a queued run **does** start once the first finishes; that second sweep is safe,
because ingestion is idempotent, and the lock is what stops them overlapping.
The lock also sees sweeps this group cannot — one started from a laptop, say.

## Exit codes, and what makes the run red

| Code | Meaning                                                              | Workflow |
| ---- | -------------------------------------------------------------------- | -------- |
| 0    | every portal collected, **or** some refused while others collected   | green    |
| 69   | **every** attempted portal refused or failed — nothing was collected | red      |
| 75   | another sweep holds the lock; this one did nothing                   | red      |
| 77   | a publisher's `robots.txt` forbids us and we stopped                 | red      |
| 78   | `DATABASE_URL` absent or empty                                       | red      |
| 64   | usage                                                                | red      |

**Partial failure stays green, deliberately.** Some portals refusing while others
collect is a gap in coverage, not a failed run: the records that arrived are
real, the ones that did not are named in the log, and
`tender_collection_window` records the outcome per portal. A workflow that went
red for one refusing portal in twenty would go red most days and stop being read.

## Monitoring

**Did today's run happen, and how did it go?** Actions → Ingest tenders. The log
names every portal with counts, and the refusals separately.

**What the database says:**

```sql
-- The last ten runs, newest first.
SELECT id, source_id, status, started_at, completed_at,
       records_seen, records_inserted, records_updated, records_unchanged,
       records_rejected, records_unresolved, error_count, note
  FROM ingestion_run ORDER BY started_at DESC LIMIT 10;

-- The last successful collection per portal, and when it was last tried.
SELECT portal_code, state_lgd_code, collecting_since,
       last_success_at, last_checked_at
  FROM tender_collection_window ORDER BY last_success_at NULLS FIRST;

-- Runs that were skipped because another sweep held the lock.
SELECT started_at, note FROM ingestion_run
 WHERE status = 'skipped' ORDER BY started_at DESC;

-- A collector that died: still 'running' long after it started.
SELECT id, source_id, started_at FROM ingestion_run
 WHERE status = 'running' AND started_at < now() - interval '2 hours';
```

`records_unchanged` is the figure worth reading. A run where every tender was
seen and none had changed is a healthy run, and without that count it looks
identical to a run that collected nothing.

## Freshness

Derived per state from the window rows, never stored as a flag:

| State           | Means                                                                 |
| --------------- | --------------------------------------------------------------------- |
| `collected`     | succeeded within 48 hours                                             |
| `stale`         | no success in 48 hours — old data, still shown                        |
| `failing`       | last attempt is **later** than the last success: attempts are failing |
| `not_collected` | **no window claims this state at all**                                |

48 hours is the first interval that cannot be one missed daily run
(`STALE_AFTER_HOURS` in `tender.repository.ts`).

A failed run leaves the previous data and the previous `last_success_at`
standing, and moves only `last_checked_at`. That is what turns a failure into
`failing` rather than into an absence.

## Recovery

1. Read the workflow log; find which portals refused.
2. `SELECT … FROM ingestion_run ORDER BY started_at DESC` for the counts and the note.
3. **Retry with `workflow_dispatch`.** Always safe — ingestion is idempotent.
4. A run that exited **75** needs nothing: another sweep was working. Retry after it finishes.
5. A run that exited **69** means every portal refused. Retry once; if it repeats, the cause is upstream — check whether the portals are reachable at all, and from where.
6. **Repeated refusals from GitHub specifically** are a vantage-point problem, not a code problem. `.docs/06-government-sources/access-and-permissions.md` records that `.gov.in` hosts have been unreachable from some networks before. Do not add a proxy, rotate a user agent, or otherwise evade a control: record the limitation and run the sweep from a network the portals answer.

## Disabling and re-enabling

Actions → Ingest tenders → **⋯ → Disable workflow**. Re-enable the same way. Do
not delete the file to pause it: a deleted workflow leaves no trace of why
collection stopped, which is the failure this whole model exists to prevent.

## Maharashtra

**Maharashtra tender ingestion remains `not_collected`, and scheduling does not
change that.** `mahatenders.gov.in` serves `Disallow: /`; no Maharashtra portal
is in the registry, so no window claims the state and none is swept. The
explorer says so in those terms rather than showing a count.

Scheduling changes what the other twenty states report. It does not make
Maharashtra tender data available, and nothing here should be read as suggesting
it does.
