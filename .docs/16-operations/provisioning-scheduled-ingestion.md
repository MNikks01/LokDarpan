# Provisioning scheduled ingestion — a walkthrough

**Written:** 7 September 2026 · **For:** the person setting this up for the first time · **Companion to:** [`collection-schedule.md`](./collection-schedule.md), which describes the schedule once it is running

Everything in the repository is ready. What is missing is infrastructure that
cannot live in a repository: a production database, a credential for it, and one
manual run to find out whether GitHub's servers can reach Indian government
portals at all.

This document is the walkthrough for that. It assumes no prior knowledge of the
project's deployment.

**Time:** about 45 minutes, most of it waiting for a database to create itself.

---

## What you are setting up, in one picture

```
GitHub Actions (daily, 20:00 UTC)
        │  runs: pnpm --filter @lokdarpan/ingestion ingest:gepnic --all
        │  reads secret: INGEST_DATABASE_URL
        ▼
  twenty GEP-NIC portals  ──►  tenders
        │
        ▼
   Neon PostgreSQL, as lokdarpan_etl_prod
        │
        ▼
   tender · tender_collection_window · ingestion_run
```

The one thing nobody has tested is the first arrow: whether a GitHub-hosted
runner in Microsoft's data centres is answered by `*.gov.in` hosts. **Step 7 is
where you find out.** Everything before it is setup.

---

## Before you start

You need:

- [ ] Admin access to <https://github.com/MNikks01/LokDarpan> (to add a secret and merge)
- [ ] An email address for a Neon account
- [ ] A terminal with this repository cloned, `pnpm` installed, and `psql` available
- [ ] A password manager, to generate and keep one database password

You do **not** need: Docker, a server, a cloud account other than Neon, or a
credit card. Neon's free tier is sufficient to start.

**Check `psql` first**, because installing it later is annoying:

```bash
psql --version
```

No output? Install it:

- **macOS:** `brew install libpq && brew link --force libpq`
- **Ubuntu/Debian:** `sudo apt install postgresql-client`
- **Windows:** install PostgreSQL from <https://www.postgresql.org/download/windows/> and tick "Command Line Tools"

---

## Step 1 — Create the production database

**Website:** <https://console.neon.tech>

1. **Sign up or sign in.** "Continue with GitHub" is the least friction.
2. Click **New Project**.
3. Fill in:
   - **Name:** `lokdarpan`
   - **Postgres version:** 16
   - **Region:** **AWS Asia Pacific (Mumbai) — `ap-south-1`**. Choose this deliberately: the data is Indian, and a database in Mumbai keeps it in the jurisdiction it describes.
4. Click **Create project**. It takes a few seconds.

You land on the project dashboard with a connection string shown.

### Enable PostGIS

Migration `0001` creates the PostGIS extension, and Neon allows it — but confirm
now rather than discovering it mid-migration.

In the Neon console, open **SQL Editor** (left sidebar) and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT postgis_version();
```

It should print a version such as `3.4 USE_GEOS=1 ...`. If it errors, the region
or plan does not support PostGIS; create the project again in a different region.

### Collect two connection strings

Neon gives you two, and **the difference matters**.

On the dashboard, find the **Connection string** panel:

- Leave **Connection pooling** _off_ → this is the **direct** string. Its host has no `-pooler`. **Use it for migrations, admin, and the scheduler.**
- Turn **Connection pooling** _on_ → this is the **pooled** string. Its host contains `-pooler`. **Use it for the website on Vercel only.**

**The scheduler must not use the pooled string.** The sweep takes a session-level
advisory lock (`pg_try_advisory_lock`, see `services/ingestion/src/advisory-lock.ts`)
so two sweeps can never write at once. Neon's pooler runs PgBouncer in
transaction mode, which hands each transaction to whichever server connection is
free. Neon documents session-level advisory locks as unsupported there. Through the
pooler the lock is taken on one server connection while the sweep runs on others,
so it protects nothing. Its release can also land elsewhere and silently fail,
leaving the lock held by the pooler, and later runs then exit 75 and collect
nothing. A job that connects once a day gains nothing from pooling anyway.

Copy both into your password manager, labelled clearly. They look like:

```
postgresql://<user>:<password>@ep-something-123456.ap-south-1.aws.neon.tech/lokdarpan?sslmode=require
postgresql://<user>:<password>@ep-something-123456-pooler.ap-south-1.aws.neon.tech/lokdarpan?sslmode=require
                                                    ^^^^^^^ the difference
```

> **Never paste either of these into a file in the repository, a chat message, a
> commit, or an issue.** They contain a password with full ownership of the
> database.

---

## Step 2 — Apply the migrations

From your terminal, in the repository:

```bash
cd /path/to/LokDarpan
pnpm install

DATABASE_URL='<DIRECT connection string>' \
  pnpm --filter @lokdarpan/database migrate
```

Note the single quotes — connection strings contain characters your shell will
otherwise interpret.

**Expected output** ends with:

```
applying 0033_a_level_is_simplified_once.sql … ok
33 migration(s) applied
```

If it says fewer than 33, you are on an older checkout. Pull `main` and run it
again. The explorer's level endpoint reads the column 0033 adds, so a database
without it fails that endpoint.

**Verify** — in the Neon SQL Editor:

```sql
SELECT count(*) AS migrations FROM schema_migration;
SELECT unnest(enum_range(NULL::ingestion_run_status))::text AS status;
```

You want `33`, and the four statuses `running, succeeded, failed, skipped`.

---

## Step 3 — Create the ingestion credential

The scheduler must **not** use the owner credential from Step 1. A credential in
GitHub that can drop the database is a larger risk than the job needs. Migration
`0031` already created the `lokdarpan_etl` role holding exactly the privileges
ingestion uses; this step creates a login user that inherits them.

**Generate a password first** — 32+ characters, from your password manager. Do
not invent one.

In the Neon **SQL Editor**, run (substituting your generated password):

```sql
CREATE ROLE lokdarpan_etl_prod LOGIN PASSWORD '<paste generated password>';
GRANT lokdarpan_etl TO lokdarpan_etl_prod;
```

Then build the connection string the scheduler will use. Take the **direct**
string from Step 1, the one whose host has no `-pooler`, and replace the username
and password:

```
postgresql://lokdarpan_etl_prod:<generated password>@ep-something-123456.ap-south-1.aws.neon.tech/lokdarpan?sslmode=require
```

Keep it in your password manager. You will paste it once, in Step 5.

---

## Step 4 — Verify the credential is what you think it is

Do not skip this. A credential that silently turns out to be the owner defeats
the entire point of Step 3.

```bash
psql '<the ETL connection string from Step 3>' -c \
  "SELECT current_user, pg_has_role(current_user, 'lokdarpan', 'MEMBER') AS is_owner;"
```

**Required output:**

```
    current_user    | is_owner
--------------------+----------
 lokdarpan_etl_prod | f
```

`is_owner` **must** be `f`. If it is `t`, you granted the wrong role — start Step 3 again.

Now confirm it can do the job, and only the job:

```bash
# Should succeed — this is what ingestion reads.
psql '<ETL connection string>' -c "SELECT count(*) FROM admin_unit;"

# Should succeed — this is what ingestion writes.
psql '<ETL connection string>' -c \
  "BEGIN; INSERT INTO ingestion_run (source_id) VALUES ('provisioning-check'); ROLLBACK;"

# Should FAIL with 'permission denied'. If it succeeds, stop and re-check Step 3.
psql '<ETL connection string>' -c "CREATE TABLE should_not_exist (id int);"
```

The third command failing is the success condition.

---

## Step 5 — Store the credential in GitHub

**Website:** <https://github.com/MNikks01/LokDarpan/settings/secrets/actions>

1. Click **New repository secret**.
2. **Name:** `INGEST_DATABASE_URL` — exactly this. The workflow reads this name and no other.
3. **Secret:** paste the ETL connection string from Step 3.
4. Click **Add secret**.

GitHub will never show it again, and will redact it from workflow logs if it ever
appears in one. That redaction is a safety net, not a licence: the workflow passes
it through the environment of one step precisely so it never reaches a command
line or a log.

**Confirm it exists:**

```bash
gh secret list
```

You should see `INGEST_DATABASE_URL` with an updated date. The value is not shown
— that is correct.

---

## Step 6 — Merge, so the workflow becomes runnable

GitHub only offers **Run workflow** for workflows that exist on the **default
branch**. `main` is the default branch here, so until the scheduler is merged
there, no manual run is possible — regardless of the secret.

1. Merge the scheduler PR into `development` (rebase — `development` requires linear history, per [`adr/032`](../adr/032-development-is-reinstated.md)).
2. Open a release PR from `development` into `main` and merge it **with a merge commit** (`main` requires one, per [`adr/042`](../adr/042-a-repo-wide-setting-cannot-express-a-per-branch-rule.md)).

Then confirm the workflow is visible:

**Website:** <https://github.com/MNikks01/LokDarpan/actions>

You should see **Ingest tenders** in the left-hand workflow list. If it is
absent, the merge to `main` did not include `.github/workflows/ingest-tenders.yml`.

---

## Step 7 — The first run, and the real test

**Website:** <https://github.com/MNikks01/LokDarpan/actions/workflows/ingest-tenders.yml>

1. Click **Run workflow** (right-hand side).
2. Leave the branch as `main`.
3. Click the green **Run workflow** button.
4. Refresh. A run appears within a few seconds. Click into it, then into the **GEP-NIC sweep** job.

Or from the terminal:

```bash
gh workflow run ingest-tenders.yml --ref main
gh run watch
```

**This takes up to 20 minutes** — twenty portals, five seconds apart, each
fetching a landing page and its detail pages.

### Reading the result

The log ends with a summary. What you are looking for:

```
kerala          21 advertised ·   4 new ·   1 changed ·  12 placed
odisha          18 advertised ·   2 new ·   0 changed ·   9 placed
...
20 portal(s): 380 advertised, 47 new, 210 placed to a district
```

That is success. Now the outcomes that are not:

| What you see                                                       | What it means                                               | What to do                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Job green, portals listed with counts                              | Collection works from GitHub                                | Nothing. You are done — go to Step 8                                                      |
| Job green, a few portals under `not collected:`                    | Partial coverage; deliberate                                | Note which. Re-run tomorrow; if the same portal fails for a week, investigate that portal |
| Job **red**, exit code **69**, every portal under `not collected:` | **Every portal refused the runner**                         | See "If the portals refuse GitHub" below                                                  |
| Job **red**, exit code **78**                                      | `INGEST_DATABASE_URL` is unset or empty                     | Re-do Step 5; check the name is exact                                                     |
| Job **red**, connection or authentication error                    | The connection string is wrong, or the user was not created | Re-do Steps 3 and 4                                                                       |
| Job **red**, exit code **75**                                      | Another sweep holds the lock                                | Wait and re-run. Only possible if you started one elsewhere                               |

---

## Step 8 — Verify what actually landed

In the Neon **SQL Editor**:

```sql
-- Did the run record itself?
SELECT id, source_id, status, started_at, completed_at,
       records_seen, records_inserted, records_updated, records_unchanged,
       records_rejected, records_unresolved, error_count, note
  FROM ingestion_run
 ORDER BY started_at DESC
 LIMIT 5;

-- Which portals now have a successful collection, and when were they last tried?
SELECT portal_code, state_lgd_code, collecting_since,
       last_success_at, last_checked_at
  FROM tender_collection_window
 ORDER BY last_success_at DESC NULLS LAST;

-- How many tenders are held, by portal?
SELECT portal_code, count(*) AS tenders
  FROM tender GROUP BY portal_code ORDER BY tenders DESC;
```

**What good looks like:**

- one `ingestion_run` row per portal, `status = 'succeeded'`, `completed_at` set
- `last_success_at` and `last_checked_at` both recent, for the portals that worked
- `records_unchanged` non-zero on the second run onwards — that is the healthy steady state, and it is the figure most worth watching

**What to be suspicious of:**

- a row still `running` an hour later — a collector died; investigate before re-running
- `last_checked_at` later than `last_success_at` — the last attempt did not complete; the explorer will show that state as `failing`
- `status = 'succeeded'` with `records_seen = 0` — the portal answered and advertised nothing, which is different from refusing

---

## Step 9 — Confirm nothing else moved

Ingestion touches tenders. It must not touch geography or the audit ledger.

```sql
SELECT
  (SELECT count(*) FROM admin_unit WHERE parent_id = (
     SELECT id FROM admin_unit WHERE level='state' AND lgd_code='27')) AS mh_districts,
  (SELECT count(*) FROM document)                                       AS documents,
  (SELECT count(*) FROM published_fact)                                 AS published_facts,
  (SELECT count(*) FROM tender_collection_window WHERE state_lgd_code='27') AS mh_windows;
```

Expected on a database that holds the full ledger: **36**, **30**, **5088**, and
**0**.

That last zero is not a defect. **Maharashtra has no collection window because no
Maharashtra portal is collected**, and the explorer says
"Tender data is not currently collected for Maharashtra" rather than showing a
count. Scheduling does not change that; see the Maharashtra section of
[`collection-schedule.md`](./collection-schedule.md).

---

## If the portals refuse GitHub

This is a real possibility and the reason Step 7 exists. Indian government hosts
have been unreachable from particular networks before — the project's own source
work records `lgdirectory.gov.in` failing from one vantage point and succeeding
from another, which is why verification uses two independent network channels
([`access-and-permissions.md`](../06-government-sources/access-and-permissions.md)).

**Do not:**

- add a proxy or a VPN hop to route around it
- change the user agent to look like a browser
- retry aggressively to force a connection
- treat a refusal as success to keep the workflow green

Every one of those converts a discovered limitation into a hidden one, and the
last also puts a false freshness claim in front of readers.

**Do:**

1. Read the log and record which portals refused and how — timeout, TLS failure, HTTP 403, or an explicit block page. These are different problems.
2. Confirm the database half works. It does if the run reached the portals at all: `ingestion_run` rows exist with `status='failed'` or counts of zero. That narrows the fault to network reachability.
3. Run the same command from a machine on an Indian network and compare. If it succeeds there, the finding is "GitHub's network is refused", not "the collector is broken".
4. Move the schedule to a runner the portals answer. Nothing in the code changes — the workflow, the ETL role, the advisory lock and the exit codes are all independent of where the process runs. The options are a small always-on host with `cron` or `systemd`, or the `launchd` pattern this repository already uses for the window sampler (`services/ingestion/scripts/in.lokdarpan.tender-sample.plist`).
5. Record the finding in `.docs/06-government-sources/`, phrased as _"not reachable from a GitHub-hosted runner on \[date\]"_ — never as "the portal is down".

---

## Routine operations, afterwards

### Run it by hand

<https://github.com/MNikks01/LokDarpan/actions/workflows/ingest-tenders.yml> →
**Run workflow**. Always safe: ingestion is idempotent, keyed on each portal's own
tender id, and `first_seen_at` is never rewritten.

### Pause collection

Same page → **⋯** (top right) → **Disable workflow**.

Do not delete the file to pause it. A deleted workflow leaves no trace of why
collection stopped, which is the confusion this whole model exists to prevent.

### Rotate the password

1. Create a second login user and grant it `lokdarpan_etl`:
   ```sql
   CREATE ROLE lokdarpan_etl_prod_2 LOGIN PASSWORD '<new generated password>';
   GRANT lokdarpan_etl TO lokdarpan_etl_prod_2;
   ```
2. Update `INGEST_DATABASE_URL` at <https://github.com/MNikks01/LokDarpan/settings/secrets/actions>.
3. Run the workflow by hand and confirm it succeeds.
4. Remove the old user.

The group role holds the privileges, so nothing else changes.

### Know whether it ran today

<https://github.com/MNikks01/LokDarpan/actions/workflows/ingest-tenders.yml>
lists every run with its result. The database is the fuller answer:

```sql
SELECT source_id, status, started_at, records_inserted, records_unchanged, note
  FROM ingestion_run
 WHERE started_at > now() - interval '2 days'
 ORDER BY started_at DESC;
```

---

## Quick reference

| Thing                 | Value                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| Neon console          | <https://console.neon.tech>                                                  |
| GitHub secrets        | <https://github.com/MNikks01/LokDarpan/settings/secrets/actions>             |
| Workflow              | <https://github.com/MNikks01/LokDarpan/actions/workflows/ingest-tenders.yml> |
| Secret name           | `INGEST_DATABASE_URL`                                                        |
| Database user         | `lokdarpan_etl_prod`, member of `lokdarpan_etl`                              |
| Connection endpoint   | **direct** (host has no `-pooler`), for the session advisory lock            |
| Schedule              | `0 20 * * *` — 20:00 UTC, 01:30 IST                                          |
| Command               | `pnpm --filter @lokdarpan/ingestion ingest:gepnic --all`                     |
| Advisory lock key     | `437642`                                                                     |
| Success               | exit 0                                                                       |
| Every portal refused  | exit 69                                                                      |
| Another sweep running | exit 75                                                                      |
| Credential missing    | exit 78                                                                      |

## What this does not achieve

It does not make Maharashtra tender data available. `mahatenders.gov.in` serves
`Disallow: /`, no Maharashtra portal is in the registry, and Maharashtra will
continue to report `not_collected` after every successful run. That is a
limitation of what the publisher permits, not of the scheduler, and the interface
states it in those terms.
