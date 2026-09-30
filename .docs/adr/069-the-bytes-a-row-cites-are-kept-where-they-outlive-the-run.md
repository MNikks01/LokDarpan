# ADR-069 · The bytes a row cites are kept where they outlive the run

**Status:** Accepted · **Date:** 2026-09-29 · **Migration:**
`0037_an_artifact_says_where_its_bytes_are.sql` · **Runbook:**
[`16-operations/raw-store.md`](../16-operations/raw-store.md)

## Context

`source_artifact` is the root of provenance: every ledger row names the sha256 of the bytes it was
read from, and migration 0006 promises that "re-extraction with a better parser must always be
possible from what was actually retrieved".

A count of production on 29 September 2026 found that promise unkept for every row:

| Source                  | Rows | Where the bytes were                                                          |
| ----------------------- | ---: | ----------------------------------------------------------------------------- |
| GePNIC landing pages    |  125 | Nowhere. Hashed in memory on a GitHub runner deleted with the job             |
| OpenStreetMap responses |   37 | Nowhere. Hashed in memory; the file named in `storage_path` was never written |
| LGD                     |    1 | On the disk of the laptop that ran the load                                   |

Two defects combined. The GePNIC and OSM collectors never called the raw store at all; they recorded
a `storage_path` shaped like one. And the raw store was a directory, which is durable only as long
as the machine holding it: a scheduled job's directory lasts one run. Nothing in a row said which
case it was in, so the gap was invisible until someone looked for a file.

## Decision

**An object store is the durable raw store.** Cloudflare R2, chosen on 29 September 2026: an
S3-compatible API, so the code is not tied to one vendor; no egress charge, which matters if the
bytes are ever offered for public verification; and a free tier larger than the corpus. The code
speaks S3 (`ObjectRawStore`, signed with `aws4fetch`), so moving to another S3-compatible store is a
change of four variables.

**Every collector stores before it records.** GePNIC and OSM now put their bytes in the store before
the row that cites them is written, and recompute the hash from the bytes written. A store that
refuses costs that portal's run, not the sweep.

**A row says where its bytes are.** `source_artifact.stored_in` is `file` or `s3://<bucket>`,
required for every new row by a `CHECK … NOT VALID` constraint.

**The old rows keep NULL.** `NOT VALID` exempts the 163 rows written before the constraint, and
NULL is the true statement about them: this ledger did not retain their bytes. The GePNIC pages
cannot be fetched again (the portals show a rolling window of current tenders) and a fresh OSM
response would hash differently. A row may be updated to name a store only by a backfill that has
put bytes hashing to its sha256 there.

**The schedule requires the object store.** `RAW_STORE_REQUIRE_OBJECT=true` makes the sweep exit 78
before fetching anything if the bucket is not configured, rather than fall back to a disk that is
deleted with the runner. Local runs without the variables keep using `data/raw`.

## Alternatives considered

- **Neon's storage buckets.** Same vendor as the database and no new account, but a newer product
  whose limits and S3 compatibility would need confirming first.
- **AWS S3.** The most established, with paid egress and heavier access setup for a one-person
  project.
- **GitHub Actions artifacts.** Retained for at most 90 days: a delay, not durability.
- **Commit the bytes to the repository.** 263 MB locally and growing, much of it under source terms
  that do not permit republication, into a public repository.

## Consequences

- Provenance of every row written from now on can be checked against bytes someone holds.
- The 162 GePNIC and OSM rows stay citations of bytes that are gone. The tenders they describe are
  re-read nightly while advertised, so current tenders gain retained evidence within a day.
- Each tender's own detail page (the source of its value, department and location) is still read
  without being stored; its fields cite the landing page. That is the next change, not this one.
- `cag:reprocess` still reads bytes from the local directory, so re-extraction from the object store
  is not yet possible.
- Release order matters: migration 0037 and the code that writes `stored_in` must reach production
  between two nightly runs (runbook §3).

## Addendum · 2026-09-30 · Detail pages are kept and cited

The consequence above, that each tender's detail page was read without being stored, is closed by
migration 0038. The collector now puts every detail page it parses into the raw store and records
it as an artefact, and `tender.detail_sha256` names the page the tender's details were last read
from. A page that cannot be stored is treated as a page that could not be read, so no field cites
bytes nobody holds. A superseded reading keeps its page in `tender_version.detail_sha256`.

What it does not claim: a page that omits a field does not erase an earlier reading (the upsert's
existing COALESCE), so a blank field on the newest page keeps a value an earlier page gave. The
earlier page is in the history. Whether an omitted field should instead be recorded as omitted is
an open question, not decided here.

Cost: about 20 detail pages per portal per night, so a few hundred artefacts and some megabytes of
R2 per night, well inside the free tier for years; identical pages are stored once.
