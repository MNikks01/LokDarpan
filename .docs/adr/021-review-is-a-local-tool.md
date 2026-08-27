# ADR-021 · Human review is a local tool, not a deployed surface

**Status:** Accepted · **Date:** 2026-08-27 · **Supersedes:** nothing

## Context

Migration 0007 made every extracted claim a _candidate_ until a person decides
on it, and `published_fact` cannot return an undecided row. That gate is only
worth having if someone can actually work through the queue, so the reviewer
interface was the blocking piece: 1,825 candidates sat unreviewed, and
therefore nothing the extraction pipeline produced could reach a reader.

The obvious build is a web page. The project is web-first (ADR-011), `apps/web`
exists and deploys to Vercel (ADR-020), and reading 282 characters of evidence
in a browser is pleasanter than in a terminal.

Three facts argue against it:

1. **No authentication exists.** Nothing in this repository authenticates a
   user. A review endpoint on a public deployment would let anyone publish a
   claim naming a company or an officer — the most consequential write this
   system performs.
2. **The API is read-only by construction.** Migration 0002 gives the API role
   `SELECT` and revokes the rest, and a startup assertion exits 78 if it can
   write. Serving review from the web app means either weakening that or adding
   a second privileged path beside it.
3. **The reviewer is one person.** There is no team, no queue contention and no
   remote-access need that a local tool fails to meet.

## Decision

**Review is a local CLI (`pnpm --filter @lokdarpan/ingestion review`), and the
reviewer role is a distinct least-privilege database role.**

- The tool connects as `DATABASE_URL_REVIEWER`, never as the owner.
- Migration 0008 grants that role `UPDATE` on exactly five columns of
  `document_fact` — `verification_status`, `verified_by`, `verified_at`,
  `corrected_value`, `reviewer_note` — plus `SELECT` on the candidate and its
  provenance. No `INSERT`, no `DELETE`, nothing on any other table.
- A reviewer identity is required and placeholders are refused.

## Why the column-scoped grant matters more than the CLI choice

The brief's rule is _never modify the original source document_. A review tool
that wrote `raw_text` would break it, and no amount of care in the tool proves
it does not. Postgres refusing the write does.

The consequence is that a correction is always recorded **beside** what the
parser read, never on top of it. `published_fact` prefers `corrected_value`, so
readers see the reviewer's figure — and anyone auditing the decision later can
still see the parser's, the sentence it came from, the page, and who signed it.

This also rules out a whole class of well-intentioned mistake: a reviewer
cannot "tidy up" an evidence sentence, cannot re-point a candidate at a
different page, and cannot hand-write a candidate that no parser produced.

## Consequences

- Review cannot be done from a phone, or by a contributor without database
  access. Accepted: the alternative is an unauthenticated write path.
- A second reviewer requires a database user. That is the correct amount of
  friction for the right to publish a claim about a named party.
- Progress is bounded by one person's attention. 1,825 candidates is real work,
  and the queue is ordered by document and page so a reviewer reads a report the
  way it was written rather than jumping between contexts.
- **This decision is revisited when authentication exists**, not before. A web
  reviewer is a reasonable thing to want; it is not reasonable without a login.

## Alternatives considered

**A web page in `apps/web` behind a feature flag.** Rejected: a flag is a
runtime condition, and the failure mode is a public write endpoint. The
protection should not be a boolean someone can flip.

**A local-only HTTP server.** Better evidence rendering, particularly for the
Devanagari halves of these bilingual reports. Rejected for now on cost: it is a
bespoke server plus a UI, and binding to localhost is a weaker guarantee than
being un-deployable. Worth revisiting if terminal review proves too slow.

**Running the CLI as the database owner.** Simpler — no new role, no new script.
Rejected: it puts the "never modify the source" rule back into the tool's own
discipline, which is exactly what the grant removes.
