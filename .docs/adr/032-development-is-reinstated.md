# ADR-032 · `development` is reinstated as the integration branch

**Status:** Accepted · **Date:** 2026-09-04 · **Reverses:** [`023-features-target-main.md`](./023-features-target-main.md) · **Restores:** [`013-branching-and-release.md`](./013-branching-and-release.md) §Decision

## Context

[`023`](./023-features-target-main.md) retired `development` on 2026-08-28 and
pointed `feature/*` at `main`. Its evidence was strong and is not disputed here:
seven consecutive pull requests had already bypassed the branch, it sat still
while `main` advanced eight commits, its one unique commit was byte-identical to
content `main` had received by another route, and reconciling it took two pull
requests — one that conflicted and one that set its tree by hand.

**The maintainer wants the integration point back.** That is a decision about how
this project should be worked on, and it is theirs to make. What follows is the
record of it, and of what reinstating actually cost, so the next person deciding
this has the facts rather than the preference.

## What reinstating cost

`development` had drifted exactly as `023` predicted it would when unused:

```text
development:  38 commits behind main,  2 ahead
protection:   required_linear_history: true,  allow_force_pushes: false
```

Two divergent commits with linear history required means the branch can neither
fast-forward nor accept a merge commit — the same deadlock `023` documented, now
larger.

It was resolved by checking rather than assuming. `development`'s tree was
**byte-identical to `main~26`** (`269eed9`, PR #39): the branch held no content
`main` lacked, only `main`'s state twenty-six commits earlier reached by a
different ancestry. It was therefore deleted and recreated from `main`, losing
nothing but that ancestry, and its protection — six required checks, strict,
linear history, no force pushes, no deletions, conversation resolution — was
captured beforehand and restored verbatim.

## Decision

```text
feature/*  ──PR──>  development  ──release PR──>  main
```

- `feature/*` branches from `development`; one focused change per pull request.
- `development` accumulates tested work; promotion to `main` is a release PR.
- Both branches keep all six required checks. `development` additionally
  requires linear history; `main` takes merge commits so release PRs keep their
  constituent commits.
- Direct pushes to either branch remain forbidden.

## What `023` got right, and still holds

`023` was the revisit `013` asked for, on the trigger `013` named: [`020`](./020-vercel-deployment.md)
gave every pull request its own preview deployment, so the soak `013` wanted from
`development` already happens per-PR, on a real deployment of that change alone.

That does not change. **`development` is therefore an integration and release
gate, not a soak.** Claiming it as a soak would be claiming something the preview
deployments already do better, and would set it up to be retired again for the
same reason.

## The failure mode to watch

`023`'s case was not that an integration branch is a bad idea. It was that
**nobody used this one**, and that nothing fails when a branch is simply not
used — the drift stayed invisible until someone looked.

That risk is unchanged and now has a second data point. Reinstating the branch
does not by itself reinstate the practice.

**Revisit if `development` is bypassed again.** Concretely: if a pull request
targets `main` that is not a release PR, or if `development` falls more than a
few commits behind `main` with nothing in flight, this ADR has failed the same
way `013` did and the honest response is to say so rather than let the branch
rot a third time.

## Consequences

- Two merges per change instead of one, plus a release PR. That is the cost of
  an integration point, and it is the cost `013` accepted and `023` declined.
- The `hotfix/*` class returns with the two-branch flow: a fix branched from
  `main` must be merged back into `development` or it is lost at the next
  release. A stale `hotfix` branch already sits on the remote from before `023`
  and should be deleted rather than reused.
- `023` keeps its status header and stays. ADRs append; the reasoning in it is
  the strongest argument against this decision, and it should remain readable.
