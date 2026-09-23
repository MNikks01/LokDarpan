# ADR-049 · A tender that changed can say what it said before

**Status:** Accepted · **Date:** 2026-09-05 · **Applies** the pattern of migration 0009 to tenders

## Context

`tender` is written by an upsert on the portal's opaque id, so a tender seen
again advances `last_seen_at` instead of arriving twice. That is right, and it
had one consequence nobody chose: when a government office moved a closing date
from 18 September to 25 September, the row afterwards held 25 September and the
earlier date was gone.

A deadline extended, an estimate raised, a description reissued — these are
exactly the changes this project exists to make traceable, and collection
destroyed them. Nothing downstream could tell a tender that had changed from one
that never did.

Ingestion had a matching gap. A run that collected nothing and a run that failed
leave the ledger in the same state — no new rows — so afterwards they were
indistinguishable, which is how "0 records" comes to be reported as a fact about
a government.

## Decision

**History is written by the database, not by the application.**
`document_fact_review_history` (migration 0009) already solved this shape for
review decisions: an append-only table, written by a `SECURITY DEFINER` trigger,
recording only changes that mean something. The same three properties are wanted
here, so the same shape is used rather than a second idea about history.

`tender` remains the current row. Nothing reconstructs state from history; the
map and the lists read the tender table exactly as before.

**Only what the source controls counts as a change.** Every run rewrites
`last_seen_at` and `dataset_version_id` on every tender it sees, and treating
those as changes would file a version per tender per run — a history of our
polling, not of the tender. Placement is excluded for a different reason:
`admin_unit_id`, `linkage_confidence` and `district_source` are **derived by our
resolver**, not published by the portal, so a change in them records that we got
better at reading, not that the government said something new. Merging the two
would make "the tender changed" mean two incompatible things.

**A run is opened before its transaction and closed after it.** `ingestion_run`
records status, timing and six separate counts. It is deliberately not part of
the load's transaction: a failed load must roll the ledger back and must not roll
back the account of the failure. Counts are not zeroed on failure either — a run
that read four hundred records before losing its connection saw four hundred, and
reporting none would state the failure as an absence.

**`dataset_version` is not extended to do this.** It answers "which vintage is
this figure from" and is stamped on every row a load writes. A version that could
fail would stop being a version.

## Consequences

Re-ingesting identical data creates no version, so a daily collector does not
accumulate one row per tender per day. A changed closing date creates exactly
one, and the same changed data arriving again creates none.

Every superseded reading keeps its own `source_sha256` and `dataset_version_id`.
A version that could not name the fetch it came from would be a claim about a
government office with no evidence behind it.

`records_unchanged` is counted separately and is the figure most easily omitted:
a run in which every tender was seen and none had changed is a healthy run, and
without that count it looks identical to a run that collected nothing.

**A caller that round-trips a timestamp through a JavaScript `Date` will create
spurious versions**, because that truncates microseconds and the trigger compares
exact values. The loaders parse the same source text each run and so produce
identical values; a future caller reading a timestamp back and writing it
unchanged would not.

This adds no read path. Nothing yet renders a tender's history to a reader —
the data is kept so that it can be, and building that surface is separate work.
