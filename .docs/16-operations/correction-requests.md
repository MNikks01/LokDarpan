# Correction requests

**Written:** 7 October 2026 · **Decision:** [ADR-075](../adr/075-a-correction-is-received-never-applied.md) · **Milestone:** M1 (#187)

Readers report data errors at `/report`, with no account. A report is a message to reviewers; it
changes no figure.

## Enabling the form in production

In this order. Until all three are done, `/report` tells readers reports cannot be received.

1. **Apply migration 0046** with the owner credential ([`applying-migrations.md`](applying-migrations.md)).
   It creates `correction_request`, its history, `submit_correction()` and the `lokdarpan_intake`
   group role.
2. **Create the login user** with a generated password, held only in the password manager:

   ```sql
   CREATE ROLE lokdarpan_intake_user LOGIN PASSWORD '<generated>';
   ALTER ROLE lokdarpan_intake_user NOSUPERUSER NOCREATEDB NOCREATEROLE;
   GRANT lokdarpan_intake TO lokdarpan_intake_user;
   ```

3. **Set `DATABASE_URL_INTAKE`** on the Vercel project (Production) to that user's **pooled**
   connection string, then redeploy. Never the owner's, and never the read-only API user's.

Check: submit a test report from `/report`, note its reference, then mark it `not_actionable`
with the note "Deployment check" (below).

## Reviewing reports

```bash
DATABASE_URL_REVIEWER=… pnpm --filter @lokdarpan/ingestion corrections:review
```

lists open reports, oldest first. For each:

1. Open the record named in `about` (`fact:123` is a figure; its document page shows it) and the
   source.
2. If the ledger is wrong, correct it with the fact review tool (`review`), which keeps the earlier
   reading and its history.
3. Record what you found:

   ```bash
   … corrections:review -- --decide=LD-0123456789 --status=corrected \
       --reviewer=you@example --note="Re-read page 12: 4.5 crore. Corrected in review."
   ```

   `--status` is `reviewing`, `corrected`, `no_change` or `not_actionable`. Every final decision
   needs a note; every earlier decision is kept in `correction_request_history`.

Read open reports at least weekly. A reference with no answer is a promise not kept.

## If the form says reports are paused

More than 200 reports arrived in an hour — a site-wide ceiling inside `submit_correction`. It lifts
itself as the hour passes. If it recurs, look at the reports for a pattern before raising it.
