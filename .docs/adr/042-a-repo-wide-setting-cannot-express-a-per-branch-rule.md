# ADR-042 · A repo-wide setting cannot express a per-branch rule

**Status:** Accepted · **Date:** 2026-09-04 · **Amends** [`041-the-merge-method-is-a-setting-not-a-checklist-line.md`](./041-the-merge-method-is-a-setting-not-a-checklist-line.md)

## Context

`041` decided that the merge method must be enforced by configuration rather than
by a line in a checklist, and named the mechanism:

> `main` allows **merge commits only**. Squash and rebase are disabled for it.

**That mechanism does not exist.** `allow_squash_merge` and `allow_rebase_merge`
are repository-wide. There is no "for it".

And the two branches need opposite things:

| Branch        | `required_linear_history` | Can be merged by                            |
| ------------- | ------------------------- | ------------------------------------------- |
| `main`        | `false`                   | merge commit                                |
| `development` | `true`                    | squash or rebase — **never** a merge commit |

Disabling squash and rebase repository-wide would have left the merge commit as
the only method, which `development` forbids. **Every feature pull request into
`development` would have deadlocked** — a broader failure than the release
deadlock `041` was written to prevent.

This was caught before it was executed, by reading the protection on both
branches rather than trusting the sentence in `041`. The reasoning in `041` was
right; the instrument it named could not carry it.

## Decision

**The constraint is a repository ruleset scoped to `main`.**

```text
ruleset 22290072 · "main takes merge commits only"
target      refs/heads/main
rule        pull_request → allowed_merge_methods: ["merge"]
enforcement active
```

Repository-wide merge settings stay permissive — merge, squash and rebase all
enabled — so `development` keeps a method its linear history accepts. Branch
protection on both branches is unchanged.

A ruleset can say "on this branch"; the repository settings cannot. That is the
whole of the correction.

## Consequences

`041`'s decision stands unaltered: the merge method is enforced by configuration,
not by memory. Only the instrument changes, and it is now one that can express a
rule about one branch.

Release PRs into `main` can be merged one way. Feature PRs into `development`
are untouched.

## What this says about writing these

`041` was written the same afternoon the defect it describes occurred, and it
named a mechanism without checking that the mechanism could do what was being
asked of it. The check took two API reads. **A decision that names an instrument
should verify the instrument exists**, on the same evidence standard this
repository applies to a government source: not asserted from memory, fetched and
recorded.

The failure is the same shape as the one `041` documents. There the rule lived in
a file with nothing enforcing it; here the enforcement was specified against a
control that could not hold it. Both are a plan that was never checked against
the system it was a plan for.

## Rejected: rewriting `041`

ADRs append. `041` records what was decided and why, and its reasoning survives
this correction intact — a later reader is better served by seeing the instrument
fail and be replaced than by finding a document that was quietly made right.

## Rejected: per-branch merge methods in classic branch protection

Classic protection has no merge-method field; `required_linear_history` only
rejects merge commits after the fact, which is what put `development` in the
deadlock rather than what would have prevented it. Rulesets are the only place
GitHub expresses this per branch.
