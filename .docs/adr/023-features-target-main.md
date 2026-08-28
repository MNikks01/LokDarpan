# ADR-023 — `feature/*` → `main`: the `development` branch is retired

**Status:** Accepted · 2026-08-28 · Amends [`013-branching-and-release.md`](./013-branching-and-release.md) §Decision. Every branch protection stands; only the target branch changes.

## Context

`013` set out `feature/* → development → main`, with `development` as the place to integrate and soak features before a release PR promoted them. That is not what happened.

Between 26 and 28 August, PRs #32, #33, #34, #35, #36, #37 and #39 all targeted `main` directly. Nothing branched from `development`. It last moved at #31 and then sat still while `main` advanced eight commits — and the drift stayed invisible until someone looked, because nothing fails when a branch is simply not used.

Two facts make this more than sloppiness:

1. **`development`'s one unique commit was already redundant.** #31 (_CAG documents — the execution half_) held `services/ingestion/src/cag/extract.ts` and `load.ts` **byte-identical** to the copies `main` received via #32. The branch was carrying nothing that had not already been promoted; its remaining differences were older revisions of files `main` had since updated.

2. **Catching it up could not be done cleanly.** `development` is protected with `required_linear_history: true`, so a merge commit is not permitted, and it could not fast-forward because #31 was a commit `main` did not contain. A rebase merge (#40) passed all six checks and then conflicted in three files where `development` held the stale copy. It was finally squared in #41 by a single commit setting its tree to `main`'s — content equality, but **not** ancestry: `development` still holds a commit `main` lacks whose diff against `main` is empty.

An integration branch that nobody integrates through, and that cannot be reconciled without leaving an artefact behind, is not an integration point. It is a second thing to keep in step.

## The condition `013` named has been met

`013` closed its trunk-based alternative with: _"Revisit once continuous deployment exists — at that point the release-PR step becomes friction rather than safety."_

[`020-vercel-deployment.md`](./020-vercel-deployment.md) introduced exactly that. Vercel builds a **preview deployment for every pull request** and serves production from `main`. The soak `development` was meant to provide now happens per-PR, on a real deployment of that change alone, before it merges — which is more informative than soaking several features together on a branch nobody visits.

This is therefore not a retreat from `013`'s reasoning. It is the revisit `013` asked for, on the trigger `013` chose.

## Decision

```text
feature/*  ──PR──>  main
```

- `feature/*` branches from `main`; one focused change per PR.
- Pull requests target `main`.
- **`development` is retired.** It is no longer a merge target and should not be branched from.
- The `hotfix/*` class dissolves with it: with one long-lived branch there is nothing to hot-fix around, and no back-merge to forget.

**Unchanged, and still enforced on `main`:**

- No direct pushes. Every change arrives by pull request.
- All six CI checks must pass: `Format · Lint · Types`, `Neutrality · Palette · Fixtures`, `Unit + Integration`, `E2E`, `Build`, `Dependencies · Secrets`.
- `strict: true` — a branch must be current with `main` before merging.
- All review conversations resolved. No force pushes, no branch deletion.
- Approving reviews remain at zero while there is a single maintainer ([`016`](./016-review-requirement.md)), and return to one when a second maintainer can approve.

## Alternatives considered

**Keep `development` and start actually using it.** The honest option, and the one this decision is measured against. Rejected because nothing about the last week suggests the step would be used: it was skipped seven times in three days by the only maintainer, without anyone deciding to skip it. A process bypassed by default is not a safeguard; it is a document that disagrees with the repository. `013`'s own Consequences section warned that branch protection "must be configured on the remote; it is not expressible in the repository" — the same gap let this drift go unrecorded.

**Keep `development` as a staging deployment target.** Attractive if the two branches deployed to different environments and one needed soak time under real traffic. Rejected on the facts: there is no separate staging deployment, no traffic to soak under, and no released versions to stage between. Preview deployments already give per-change verification.

**Delete the `development` branch outright.** Deferred rather than rejected. Deleting it is a protected-branch operation, and the branch is now content-identical to `main`, so it is harmless where it stands. Retiring it in the documentation is the part that stops it silently rotting again; removing the branch is a maintainer's housekeeping call.

**Return to `development` later when the team grows.** Explicitly kept open — see below.

## Trade-offs

- **No integration point between features.** Two features that pass CI separately and conflict semantically will now meet on `main` rather than on `development`. This is a real loss, and the mitigation is genuine but partial: preview deployments catch it per-PR, and `strict: true` forces a branch current with `main` before merging, so the second feature is at least built and tested against the first.
- **`main` must always be releasable**, because it is what is deployed. That was already true under `020`; this decision makes it explicit rather than introducing it.
- **No batching of a release.** There is no longer a natural place to hold several changes and announce them together. Nothing currently needs one.

## Revisit when

- A **second maintainer** joins — an integration branch earns its cost when more than one person merges in a day, and `016`'s review count returns to one at the same moment.
- **Versioned or announced releases** begin, where holding changes back to ship together has value.
- A **staging environment** exists that is meaningfully different from a preview deployment.

## Consequences

- `CONTRIBUTING.md` and [`../01-product/sprint-plan.md`](../01-product/sprint-plan.md) are updated in the same change, so the three places describing the flow agree.
- The documented process now matches what the repository's history shows, which is the point: a decision that lives only in practice gets reversed by the next person who reads the docs instead.
