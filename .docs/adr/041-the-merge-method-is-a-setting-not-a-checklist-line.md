# ADR-041 · The merge method is a setting, not a checklist line

**Status:** Accepted · **Date:** 2026-09-04 · **Amends** [`032-development-is-reinstated.md`](./032-development-is-reinstated.md)

## Context

`032` set out the flow and one condition that makes it work:

> `development` additionally requires linear history; **`main` takes merge
> commits so release PRs keep their constituent commits.**

That sentence is the whole mechanism. A merge commit on `main` keeps
`development`'s commits as ancestors, so the post-release step —
`git push origin origin/main:refs/heads/development` — is a fast-forward and
succeeds.

Release PR #87 was merged with a **rebase**. Fourteen commits were re-created on
`main` with new hashes, and `development` became:

```text
development:  14 behind main,  14 ahead
protection:   required_linear_history: true,  allow_force_pushes: false
```

Divergence with linear history required and force pushes forbidden means the
branch can neither fast-forward nor accept a merge commit. That is the deadlock
`023` documented and `032` was written to end. **It is the third occurrence.**

Nothing was lost, and that was established rather than assumed:
`git diff origin/main origin/development` was empty — the trees byte-identical —
and `git cherry origin/main origin/development` reported no commit absent from
`main`. The branches held the same content by two ancestries.

The instruction was never wrong. It was written in a file, and the setting that
would have enforced it was left open.

## Decision

**Repository settings, not the checklist, decide how a release PR merges.**

- `main` allows **merge commits only**. Squash and rebase are disabled for it, so
  a release PR cannot be merged in a way that breaks the fast-forward, whatever
  the person merging happens to click.
- The checklist line stays, as the explanation. It is no longer the control.
- The post-release step is **verified rather than assumed**. Before the
  fast-forward, `git merge-base --is-ancestor origin/development origin/main`
  answers whether the release merged the way it had to.

## Consequences

The failure mode is now unreachable through the interface, which is the only
place it has ever come from. Three occurrences, each recovered by hand, each
recovered correctly, and none of them prevented by the document that described
the rule.

`main`'s history keeps its constituent commits, which is what `032` wanted from
the merge commit in the first place — a release that reads as the work it
contains rather than as one squashed lump.

## Recovering when it happens anyway

The recovery is the same one `032` performed, and it starts by checking rather
than assuming:

1. `git diff origin/main origin/development` — empty means no content differs.
2. `git cherry origin/main origin/development` — no `+` line means every commit
   has an equivalent on `main`.
3. Only then, with both confirmed, point `development` at `main`: allow force
   pushes momentarily and
   `git push --force origin origin/main:refs/heads/development`, or delete and
   recreate the branch with its protection captured beforehand and restored
   verbatim.

Do not skip 1 and 2. They are what distinguishes a branch that lost its ancestry
from a branch that holds work `main` does not.

## What this does not change

`development` keeps linear history and keeps force pushes forbidden. Both earned
their place: the protection is what turned a silent divergence into a rejected
push and a diagnosis, rather than into a branch quietly carrying two histories.

## Rejected: allowing force pushes on `development`

It would make the recovery a one-liner and remove the signal. The rejected push
is how this was noticed at all; a branch that accepts any history accepts a wrong
one.

## Rejected: dropping linear history on `development`

`development` could then absorb `main` by merge, and the deadlock would go away.
So would the guarantee that its history is the history of its pull requests —
which is what makes a release PR's diff readable.
