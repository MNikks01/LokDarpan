# ADR-070 · The reviewed ledger is copied, not re-derived

**Status:** Accepted · **Date:** 2026-09-30 · **Runbook:**
[`16-operations/promoting-the-cag-corpus.md`](../16-operations/promoting-the-cag-corpus.md)

## Context

On 29 September 2026 production held no audit reports. The 30 CAG reports, their 6,339 pages and
the 5,088 figures a person had verified existed only in the local database, where extraction and
review are done (ADR-021: review is a local tool). Every surface built for them (documents, evidence
and audit explorer) rendered empty on the live site.

Two constraints shaped how to get them there:

- **The decisions exist only locally.** Re-running the pipeline against production would re-extract
  every candidate as unverified, and `published_fact` shows none of those.
- **Production has 512 MB.** The local corpus is about 404 MB, 361 MB of it `document_text_item`,
  the per-word positions the extractor reads. The site never reads it; each figure carries its own
  rectangle (`document_fact.bbox_*`, ADR-036).

## Decision

**Copy the reviewed rows, with their decisions, into production** (`promote:cag`). Documents,
pages, every figure with its review state, same-figure links and review history are copied. Ids are
reserved from the target's own sequences and every reference is rewritten. Places are matched by
LGD code, never by id.

**Leave `document_text_item` behind.** Production is for reading; the extractor's working data
stays where extraction happens.

**Refuse rather than guess.** Different migrations, a place the target lacks, or bytes that do not
hash to their artefact stop the run before any write. The copy is one transaction whose counts
must equal the source's before it commits. It is a dry run unless `--commit` is typed.

**Bytes before rows.** Each report goes to the R2 bucket (ADR-069) before its row is written. The
store is content-addressed and append-only, so a rolled-back run leaves nothing inconsistent.

## Alternatives considered

- **Re-run the pipeline in production and review there.** Repeats 6,000+ decisions already made,
  and points review tooling at the production database.
- **`pg_dump` / `pg_restore` of the document tables.** Ids and dataset versions would collide with
  production's; places are referenced by local ids; and nothing would check the result.
- **Upgrade the database to fit the text items.** Pays every month to store data no reader uses.

## Consequences

- The corpus reaches production in one reviewed step, about 54 MB, with provenance intact. A
  rehearsal into a copy of production's shape matched the source on counts and on fingerprints of
  every published figure, the review history and all page text.
- A report is promoted once. Decisions made locally afterwards do not follow it; re-promoting means
  removing it first. That is acceptable while review is finished before promotion. If review ever
  continues after publication, this needs an update path.
- Re-extraction cannot run in production. It never should.
