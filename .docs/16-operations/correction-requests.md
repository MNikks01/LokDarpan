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

   ```bash
   INTAKE_PW=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-32)
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pw="$INTAKE_PW" <<'SQL'
   CREATE ROLE lokdarpan_intake_user LOGIN PASSWORD :'pw';
   GRANT lokdarpan_intake TO lokdarpan_intake_user;
   SQL
   ```

   No `ALTER ROLE … NOSUPERUSER NOCREATEDB NOCREATEROLE`: Neon's owner is not a superuser and may
   not name the `SUPERUSER` attribute at all, even to clear it (found on 8 October 2026). A new role
   has all three off by default; confirm it, expecting `f|f|f|t|t`:

   ```bash
   psql "$DATABASE_URL" -At -c "SELECT r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolcanlogin,
          pg_has_role('lokdarpan_intake_user', 'lokdarpan_intake', 'MEMBER')
     FROM pg_roles r WHERE r.rolname = 'lokdarpan_intake_user'"
   ```

   The local script (`database/scripts/create-local-intake-user.sql`) keeps the `ALTER`: the Docker
   owner is a superuser there.

3. **Set `DATABASE_URL_INTAKE`** on the Vercel project (Production) to that user's **pooled**
   connection string (the owner's host with `-pooler` after the endpoint id), piped rather than typed:
   `printf %s "$INTAKE_URL" | vercel env add DATABASE_URL_INTAKE production`. Never the owner's, and
   never the read-only API user's. Check it is fenced in first: `psql "$INTAKE_URL" -c "SELECT
count(*) FROM correction_request"` must fail with "permission denied".

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
