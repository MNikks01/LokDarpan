# ADR-029 · An unreachable advisory service is not a clean audit

**Status:** Accepted · **Date:** 2026-09-04 · **Relates to:** [`016-review-requirement.md`](./016-review-requirement.md)

## Context

The `Dependencies · Secrets` job ran `pnpm audit --audit-level high`. On
2026-09-04 it began failing on every run, twice in succession, while the other
five required checks passed.

The cause was not a dependency:

```text
GET  https://registry.npmjs.org/          → 200 in 0.29s
POST https://registry.npmjs.org/-/npm/v1/security/audits   → socket timeout (30s)
POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk → socket timeout (30s)
```

The registry was healthy; both advisory endpoints hung, from the CI runner and
from a maintainer's machine alike. `main` had passed the same check the previous
day. npm's advisory service was degraded.

`pnpm audit` exits 1 for that, and exits 1 for a genuine high-severity advisory.
The job could not tell the two apart, so a third-party outage blocked every merge
in the repository.

**That is the dangerous part, and it is not the merge delay.** The only way past
a stuck required check is `gh pr merge --admin`, which bypasses _all six_
required checks rather than the one that is stuck.
[`016`](./016-review-requirement.md) exists because exactly that happened three
times in two days, and it records the conclusion: _a gate that can only be
satisfied by disabling the gates is worse than no gate, because it makes
bypassing protection routine and unremarkable._ A check that fails for reasons
nobody can act on manufactures that situation on a schedule.

## Decision

**Fail on a finding. Warn, and do not fail, when nobody could be asked.**

`.github/scripts/audit-dependencies.sh` separates the two outcomes.

`pnpm audit --json` prints JSON in both cases, so parseability decides nothing.
When the request fails it prints an object whose only key is `error`:

```json
{ "error": { "code": "ERR_SOCKET_TIMEOUT", "message": "request to … failed" } }
```

A report **without** that key is an answer, and whatever it says is binding: exit
0 passes, exit 1 fails and prints each advisory with its severity, module and
URL. A response **with** it is not an answer — retried three times, then reported
and allowed through.

The wording is chosen so nobody can misread the outcome. The annotation says the
dependencies **were not audited**, that this is _"not a clean result; it is an
absent one"_, and to re-run the job when the service recovers. A job summary says
the same. A green tick that silently meant "unverified" would be worse than the
outage.

## What this gives up

It is a real reduction in strictness: there is now a window in which a
dependency carrying a high-severity advisory could merge, if npm's service
happens to be down at that moment.

Accepted, because the alternative is not "stricter" in practice. Failing closed
on a third-party outage produces admin-merges, and an admin-merge skips the
secret scan, the type check, the test suite and the neutrality gate too. Trading
a narrow, loudly-announced gap in one check against a habit of disabling six is
the better trade for a repository with one maintainer and no production deploy.

Revisit if this stops being true — a team, or a deployment pipeline, changes the
calculation, and a scheduled audit on `main` would then be the right backstop.

## Alternatives considered

**Retry longer.** Only widens the window before the same failure. The service was
down for the better part of an hour.

**`continue-on-error: true` on the step.** One line, and wrong: it makes the step
green whatever happens, including a genuine advisory. The whole point is that one
of the two outcomes must still fail the build.

**Drop the audit.** No. It catches real things; it just has to be honest about
when it did not run.

**A vendored advisory database.** Removes the network dependency entirely and is
the right long-term answer if this recurs. Rejected now as disproportionate — it
needs its own freshness story, and a stale local database is its own way of
reporting "clean" without having checked.
