# ADR-028 · Changesets for the record, not the release

**Status:** Accepted · **Date:** 2026-09-04 · **Complements:** [`013-branching-and-release.md`](./013-branching-and-release.md)

## Context

The repository had no changelog of any kind — no `CHANGELOG.md`, no
`.changeset/`, no release notes. The record of what changed was git history and
the ADRs.

That was survivable while the repository was documentation and a scaffold. It
stopped being survivable once ingestion began writing figures that a reader will
be shown as facts about public money.

The gap is specific. Conventional commits — enforced here by `commitlint` — say
what one commit did. An ADR says why a decision was taken. Neither answers the
question that actually gets asked:

> This figure changed. What changed in the code that reads government PDFs, and
> why?

That question came up in this very session. Between two states of the repository,
79 candidates stopped existing because `Rs` began requiring a word boundary, and
168 were retired because loading became reconciling. Every one of those was a
defensible improvement, and none of them was findable from anywhere except a
reviewer's memory of the pull request.

This project's whole claim is that a number can be traced to the document it came
from. The code that reads those documents should meet the same standard.

## Decision

**Adopt Changesets, configured to version and write changelogs but never to
publish or tag.**

- Every package is `private: true` at `0.0.0` and `pnpm publish` is never run.
  `privatePackages` is `{ "version": true, "tag": false }`, so
  `changeset version` writes versions and `CHANGELOG.md` files and does nothing
  else. Nothing is released. Nothing is tagged.
- **A pull request that changes what the pipeline extracts, stores or publishes
  carries a changeset.** Parser patterns, normalisation, the review gate, the
  schema — these change figures, so they always need one.
- Documentation, tests, formatting and provably output-neutral refactors do not.
- The summary is written for a person reading it in a year: what changed and what
  it means for the data, not what the diff did.

## Why not the alternatives

**A hand-maintained `CHANGELOG.md`.** One file, no tooling. Rejected because a
monorepo of ten packages needs to say _which_ package changed — "the parser now
requires a word boundary" belongs in the ingestion service's history, not in a
list also containing web styling. A single file also drifts, because nothing
fails when someone forgets it.

**Generate it from conventional commits.** `commitlint` already enforces the
format, so the data is there, and this costs nothing to adopt. Rejected because
a commit subject is written for a reviewer looking at a diff and is nearly always
too small a unit: `fix(ingestion): require word boundary before Rs` is accurate
and tells a reader nothing about 79 candidates that were years and paragraph
numbers. The changeset is prose written deliberately, once, about a whole change.

**Nothing, and rely on ADRs.** Rejected because ADRs record _decisions_ and most
behaviour changes are not decisions — a parser fix is not an architecture choice,
and inflating every one into an ADR would devalue the ones that are.

## Consequences

- One more file per behaviour-changing PR. That is the cost, and it is the point.
- Versions will move off `0.0.0`. They are records of change, not a release
  series, and nothing consumes them.
- `changeset status --since=main` can gate a PR in CI. Not wired up here: it
  would need care so that documentation-only PRs are not blocked, and a gate that
  fires wrongly gets disabled. Left as a deliberate follow-up.
- Internal dependents pick up a patch bump (`updateInternalDependencies`), so a
  database change moves `@lokdarpan/api` and `@lokdarpan/web` too. Correct — they
  are built against it.
