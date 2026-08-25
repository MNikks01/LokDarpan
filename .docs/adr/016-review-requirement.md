# ADR-016 — No required approving review while the project has one maintainer

**Status:** Accepted · 2026-08-25 · Amends [`013-branching-and-release.md`](./013-branching-and-release.md) §Decision, final bullet.

## Context

`013` required "at least one approving review before merge", and GitHub branch protection enforced `required_approving_review_count: 1` on `main` and `development`.

The project has one maintainer. That rule could therefore never be satisfied honestly: a maintainer cannot approve their own pull request, so every merge required `gh pr merge --admin`, which bypasses **all** branch protection — the six required CI checks included, not just the review.

This happened three times in two days (PRs #3, #5, and the release PR). The rule intended to add a check was instead training the only workflow that removes every check. A gate that can only be satisfied by disabling the gates is worse than no gate, because it makes bypassing protection routine and unremarkable.

## Decision

**Set `required_approving_review_count` to 0 on `main` and `development`. Change nothing else.**

Still enforced on both branches, unchanged:

- No direct pushes. Every change arrives by pull request.
- All six CI checks must pass: `Format · Lint · Types`, `Neutrality · Palette · Fixtures`, `Unit + Integration`, `E2E`, `Build`, `Dependencies · Secrets`.
- `strict: true` — a branch must be current with its base before merging.
- All review conversations resolved.
- No force pushes, no branch deletion.
- Linear history on `development` (`main` takes merge commits so release PRs keep their constituent commits).

The pull request itself is retained deliberately. It is where CI runs, where the diff is reviewable, and where the reasoning is recorded — none of which depended on the approval count.

## Consequences

- **`--admin` should now never be necessary.** If a merge requires it, that is a signal something is genuinely wrong, not routine friction. Treat its use as a defect.
- **Restore this to 1 when a second maintainer joins.** It is a one-line change and the reason it was relaxed disappears the moment someone else can approve.
- `013` is not rewritten — ADRs append. This amends its final bullet.

## Alternatives considered

| Option                                   | Why not                                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep 1, continue using `--admin`**     | The status quo, and the reason for this ADR. Normalises bypassing every protection at once, and leaves no signal distinguishing a routine merge from an override. |
| **Keep 1, add a bot account to approve** | Ceremony that produces a rubber-stamp approval carrying no information, plus a second credential to manage.                                                       |
| **`enforce_admins: true` and keep 1**    | Would make the branch genuinely unmergeable by its only maintainer.                                                                                               |
| **Drop protection entirely while solo**  | Loses the CI gates, which are the part actually doing work — they have caught four real defects on the first run alone.                                           |
