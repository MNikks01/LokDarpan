# The raw store

**Written:** 29 September 2026 · **Decision:** [ADR-069](../adr/069-the-bytes-a-row-cites-are-kept-where-they-outlive-the-run.md) · **Code:** `services/ingestion/src/raw-store.ts`

Every row in the ledger names the sha256 of the bytes it was read from. This runbook is about
keeping those bytes somewhere they outlive the run that fetched them.

## 1. What decides where bytes go

| Environment                                   | Store                                | `stored_in` on the row |
| --------------------------------------------- | ------------------------------------ | ---------------------- |
| All four `RAW_STORE_S3_*` variables set       | The bucket                           | `s3://<bucket>`        |
| None set                                      | `RAW_STORE_ROOT`, or `data/raw`      | `file`                 |
| None set, and `RAW_STORE_REQUIRE_OBJECT=true` | **Refused**, exit 78                 | —                      |
| Some but not all set                          | **Refused**, naming the missing ones | —                      |

The nightly sweep sets `RAW_STORE_REQUIRE_OBJECT=true`: its runner's disk is deleted with the job.
A load you run by hand against **production** should use the bucket too. `file` on a production row
means the bytes are on whichever machine ran the load.

Objects are keyed `<source_id>/<ab>/<cd>/<sha256>` and carry `x-amz-meta-sha256`. A key that already
exists is checked against that hash and its size; a mismatch stops the run.

## 2. Setting up Cloudflare R2 (once)

You do this yourself. No credential is ever pasted into a chat, a commit or a file in the repository.

1. **Create the bucket.** Cloudflare dashboard → R2 → Create bucket. Name: `lokdarpan-raw`.
   Location hint: Asia-Pacific. Leave public access **off**: several sources' terms do not permit
   republishing their bytes.
2. **Create an API token.** R2 → Manage R2 API tokens → Create API token. Permission: **Object Read
   & Write**, scoped to `lokdarpan-raw` only. Keep the access key ID and secret in your password
   manager; the secret is shown once.
3. **Note the endpoint.** `https://<account id>.r2.cloudflarestorage.com`. The account ID is on the
   R2 overview page. No bucket name, no trailing slash.
4. **Add four repository secrets.** GitHub → Settings → Secrets and variables → Actions:

   | Secret                           | Value                    |
   | -------------------------------- | ------------------------ |
   | `RAW_STORE_S3_ENDPOINT`          | the endpoint from step 3 |
   | `RAW_STORE_S3_BUCKET`            | `lokdarpan-raw`          |
   | `RAW_STORE_S3_ACCESS_KEY_ID`     | from step 2              |
   | `RAW_STORE_S3_SECRET_ACCESS_KEY` | from step 2              |

5. **Check it from your machine** before trusting the schedule to it. With the four variables
   exported in your shell (not written to a file in the repository), run one portal against the
   **local** database:

   ```bash
   pnpm --filter @lokdarpan/ingestion ingest:gepnic --portal=kerala
   ```

   The first line printed is `raw store: s3://lokdarpan-raw`, and the R2 dashboard then shows a
   `gepnic-kerala/…` object.

## 3. Releasing migration 0037 (order matters)

Migration 0037 adds `source_artifact.stored_in` and requires it on new rows. The old sweep does not
write it, and the new sweep writes a column the old schema does not have, so **the migration and the
release must both land between two nightly runs** (the sweep starts at 20:00 UTC).

1. Complete §2, secrets included. A release without them makes the sweep exit 78 and collect nothing.
2. Merge the release into `main` and wait for Vercel and every check.
3. Apply the migration with the owner credential (the direct connection string):

   ```bash
   DATABASE_URL='<direct owner connection string>' pnpm --filter @lokdarpan/database migrate
   ```

   Expected: `applying 0037_an_artifact_says_where_its_bytes_are.sql … ok`.

4. Trigger the sweep by hand (Actions → Ingest tenders → Run workflow) and confirm:

   ```sql
   SELECT stored_in, count(*) FROM source_artifact GROUP BY 1;
   ```

   New rows show `s3://lokdarpan-raw`. The 163 rows from before the migration show NULL, which is
   correct: their bytes were not retained (ADR-069).

## 4. What is not covered yet

- **Tender detail pages** are read without being stored; each tender's fields cite the landing
  page's hash. Fixing that is the next change.
- **`cag:reprocess`** reads bytes from the local directory only.
- **Backfilling old rows.** A row whose bytes still exist (today, the one LGD page on the machine
  that loaded it) may be given a `stored_in` only after those bytes are put in the bucket and hash to
  its sha256. There is no tool for this yet; do not update `stored_in` by hand.
