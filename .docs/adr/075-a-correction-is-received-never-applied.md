# ADR-075 · A correction is received, never applied

**Status:** Accepted · **Date:** 2026-10-07 · **Implements** LD-004 of milestone M1 (#187) · **Builds on** ADR-021, ADR-059, ADR-068

## Context

`17-legal/legal-ethical-rules.md` §Corrections requires "a visible **report a data issue** path"
that lets anyone — including a named department or contractor — flag an error, and requires that
corrections be made by re-reading the source, versioned and logged.

The site's "Report a data issue" link opened a new GitHub issue. That needed a GitHub account,
named no figure, and published the report the moment it was filed — including anything personal a
reader wrote in it. It met the letter of the rule and not its purpose.

A replacement is the site's **first write path from the public**. Everything else downstream of
ingestion is read-only (`CLAUDE.md`), so this needs its own boundary.

## Decision

1. **A report is a message to reviewers, never a change.** It is stored in `correction_request`
   (migration 0046), apart from the ledger. A figure changes only when a reviewer re-reads the
   source and decides through the existing review tools, which keep history (0009). The report
   records what the reviewer found: `corrected`, `no_change` or `not_actionable`, with a note.
2. **The public role can do exactly one thing.** The form connects as `lokdarpan_intake`, which may
   execute `submit_correction()` and nothing else — no SELECT, INSERT or UPDATE on any table,
   proven by statement in `intake-role.integration.test.ts`. The read-only API role's default
   SELECT is revoked, so reports are never served back out.
3. **Limits that hold when others fail.** Same-origin posts only; a 16 KB body cap; the edge rate
   limit; a honeypot field (a filled one is told it succeeded, and nothing is stored); validation
   in `@lokdarpan/domain` mirroring the table's constraints; and a **site-wide hourly ceiling of
   200** enforced inside `submit_correction`, because the edge limit fails open by design.
4. **Nothing identifies the reporter.** No name, email address or IP address is stored. A
   correction is judged on the source, not on who asked; and a report stored with personal data
   would be a liability the project does not need. The reader gets a reference (`LD-…`) to quote.
5. **No JavaScript needed.** `/report` is a plain HTML form; the route answers a form post with a
   redirect, a JSON post with JSON. Every verified figure links to the form with its subject
   filled in (`fact:<id>`); the footer links to it for anything else.

## Alternatives considered

- **Keep GitHub issues.** Public by default, needs an account, collects whatever a reader types.
- **A hosted form service.** Sends readers' reports to a third party and adds a processor the
  project would have to vouch for.
- **Insert as the read-only API user with an added INSERT grant.** Turns the role every page uses
  into one that writes, for one form.

## Consequences

- Production needs three operational steps before the form works: apply 0046, create the intake
  login user with a managed secret, set `DATABASE_URL_INTAKE` on Vercel
  (`16-operations/correction-requests.md`). Until then `/report` says reports cannot be received.
- Reviewers run `corrections:review` as the reviewer role. A reference with no answer is a promise
  unkept, so the runbook asks for open reports to be read at least weekly.
- No reply channel exists: with no contact stored, a reader learns the outcome only by checking
  the record. A reply path, if wanted, is a separate decision about collecting contact details.
