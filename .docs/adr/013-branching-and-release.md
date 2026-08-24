# ADR-013 — Branching: `feature/*` → `development` → `main`

**Status:** Accepted · 2026-08-24

## Context

Until now, work was committed directly to `main`. That was acceptable for a documentation repository with one author; it is not acceptable now that `apps/web`, `services/api` and three domain packages exist, CI gates enforce `docs/15`, and outside contributors are the stated growth model for source connectors ([`../15-scalability/scalability-plan.md`](../15-scalability/scalability-plan.md)).

## Decision

```text
feature/*  ──PR──>  development  ──release PR──>  main
hotfix/*   ──PR──>  main  ──back-merge──>  development
```

- **Never push directly** to `main` or `development`. Both are branch-protected.
- `feature/*` branches from `development`; one focused change per PR.
- `development` accumulates tested work; promotion to `main` is a release PR.
- `hotfix/*` branches from `main` for production defects, and **must be merged back into `development`** so the fix is not lost in the next release.
- Required CI checks and at least one approving review before merge.

## Alternatives considered

**Trunk-based development with feature flags.** Genuinely appropriate for a team shipping many times a day, and it avoids long-lived branch divergence. Rejected for now: there is no deployment pipeline, no flag infrastructure, and a one-to-two person team. Trunk-based development without CI-gated automated deployment provides the costs and none of the benefits. **Revisit once continuous deployment exists** — at that point the release-PR step becomes friction rather than safety.

**GitFlow with `release/*` branches.** Rejected as over-engineering: no versioned artefacts, no parallel release maintenance, no long-lived support branches. The extra branch class would be ceremony.

**PRs straight to `main`, no `development`.** Simpler, and defensible. Rejected because the platform will accumulate several features between public releases, and `development` gives a place to integrate and soak them together before promoting.

## Trade-offs

- A second merge step per feature — the cost of an integration point.
- `development` can drift from `main` if releases are infrequent; mitigated by keeping release PRs small and frequent.
- Hotfix back-merges are a manual step that is easy to forget, and forgetting silently reintroduces the bug. Called out in `CONTRIBUTING.md`.

## Consequences

- No unreviewed change reaches `main`.
- CI is the gate, not convention.
- Branch protection must be configured on the remote; it is not expressible in the repository.
