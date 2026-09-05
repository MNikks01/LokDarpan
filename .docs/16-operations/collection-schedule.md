# Collection schedule — what must run, and what is running

**Date:** 5 September 2026 · **Related:** [`adr/048`](../adr/048-a-count-is-not-a-claim-about-the-world.md) (freshness semantics), [`06-government-sources/tender-collection-cadence.md`](../06-government-sources/tender-collection-cadence.md)

## The state this records

**Nothing is scheduled.** All twenty portal collection windows last succeeded on
1 September 2026. Four days later every one of them reports `stale`, and
`last_checked_at` is null on all of them, so no portal can report `failing`
either — the state that says "attempts are being made and failing" is currently
unreachable, because no attempts are being made.

This is not a defect in the code. The freshness model works; there is no
scheduler behind it.

## What the product promises, and what that requires

`tender_collection_window` records the floor below which absence means "we were
not looking". A window that stops advancing does not become wrong — it becomes
old, and the explorer says so. That is why an unscheduled collector degrades to
`stale` rather than to a silent lie.

The staleness threshold is **48 hours** (`STALE_AFTER_HOURS` in
`tender.repository.ts`), chosen because the GePNIC landing page is polled daily
and two days is the first interval that cannot be one missed run. A collector
running less often than daily will report `stale` permanently, which would be
accurate and useless.

| Collector            | Command                                            | Cadence required    | Running                   |
| -------------------- | -------------------------------------------------- | ------------------- | ------------------------- |
| GePNIC landing pages | `pnpm --filter @lokdarpan/ingestion ingest:gepnic` | daily               | **no**                    |
| Window sampler       | `ingest:gepnic-sample`                             | as scheduled in #63 | launchd, outside the repo |
| CAG reports          | `ingest:cag`                                       | on demand           | manual                    |
| OSM boundaries       | `ingest:osm-boundaries`                            | on demand           | manual                    |

Only the first needs a schedule for the product's freshness claims to hold. The
others describe holdings that do not go stale in the same way: an audit report
published in 2026 is still that report tomorrow.

## Why no scheduler is added here

A scheduler is a deployment decision, not a repository one, and the target is not
yet chosen — the web tier deploys to Vercel
([`deployment-vercel.md`](./deployment-vercel.md)) while ingestion runs against a
database Vercel does not host. Committing a cron file for one of those would
encode a choice nobody has made.

What this file does is remove the ambiguity: if the tender surface is shown to
readers, **a daily `ingest:gepnic` must be scheduled somewhere**, and until it is,
every collected state correctly reads `stale`.

## Maharashtra

Unaffected. No Maharashtra portal is collected at all
([`gepnic-access-findings.md`](../06-government-sources/gepnic-access-findings.md)),
so Maharashtra reports `not_collected` regardless of any schedule. Scheduling
changes what the other twenty states say, not what Maharashtra says.

## What an operator should be able to answer

Each is answerable today from `ingestion_run` and `tender_collection_window`:

- **What ran, when, for which source?** `ingestion_run.source_id`, `started_at`, `completed_at`
- **How many records?** the six counts, `records_unchanged` included
- **What failed and why?** `status`, `error_count`, `note` — written outside the load's transaction, so a rollback does not erase the account of the failure
- **When did it last succeed?** `tender_collection_window.last_success_at`
- **When was it last tried?** `last_checked_at`, which is deliberately not the same column
- **Is the data stale?** derived per state, never stored as a flag

`ingestion_run` holds no rows yet: no collection has run since the table was
added. That is the expected reading of an unscheduled collector, and it is
visible rather than inferred.
