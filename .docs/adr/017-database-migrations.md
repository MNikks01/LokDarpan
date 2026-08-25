# ADR-017 — Plain SQL migrations with a checksum-verifying runner

**Status:** Accepted · 2026-08-25

## Context

Sprint 1 needs a schema and a way to evolve it. The standing bar requires migrations to be version-controlled with no manual schema changes ([`../01-product/sprint-plan.md`](../01-product/sprint-plan.md)), and the engineering standards rule out introducing infrastructure without a concrete requirement.

The ledger has a property that shapes this decision: **ETL is the only write path**, and every downstream consumer is read-only. A schema change is therefore not a routine application concern — it is a change to the one thing the entire platform's traceability rests on.

## Decision

**Plain `.sql` files in `database/migrations/`, applied by a small runner in `packages/database`.**

- Filenames are `NNNN_snake_case.sql`; the numeric prefix is the order. A non-conforming name is an error, not a file to skip.
- Each migration and its bookkeeping row are applied in **one transaction**. A migration that fails is not recorded.
- Every applied migration's SHA-256 is stored. **If the file later differs from what was applied, the runner refuses to run** — it does not re-apply, and does not warn and continue.
- If the database reports a migration the repository does not contain, the runner refuses: the database is ahead of the code, and proceeding would be a silent downgrade.

## Why not a migration framework

`node-pg-migrate`, Prisma Migrate, Drizzle Kit and Knex were considered.

1. **PostGIS, generated identity columns, partial indexes, enum types and `CHECK` constraints are all first-class in SQL** and second-class in every JS abstraction over it. This schema uses all five in migration `0001`. Writing SQL through a DSL that then emits SQL adds a translation layer whose failure mode is a silently different table.
2. **The migration file is an auditable artefact.** A reviewer reading `0001_admin_unit.sql` sees exactly what will execute. That property matters more here than in a typical application, because the schema encodes the provenance guarantees.
3. **No requirement is unmet.** The features these tools add beyond ordered SQL — model-diffing, generated rollbacks, schema introspection — are ones this project should not use anyway. An auto-generated rollback that drops a column of ingested government data is worse than no rollback.

## Why checksum verification

An edited migration is the failure this design exists to prevent. Without it, the database and the repository disagree about what was executed while both appear healthy, and the disagreement surfaces later as data that does not match its stated schema. Detecting it costs one hash per file.

## Alternatives considered

| Option                         | Why not                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **An ORM's migration tool**    | Requires adopting the ORM. There is no ORM, and `.docs/02-architecture/system-architecture.md` does not call for one. |
| **`node-pg-migrate`**          | Closest fit; adds a dependency and a JS DSL to gain features listed above as ones to avoid.                           |
| **Forward-only, no checksums** | Simpler, and the failure it permits is precisely the one that must not happen silently.                               |
| **Generated down-migrations**  | A rollback that drops ingested data is more dangerous than a manual forward fix.                                      |

## Trade-offs

- **No automatic rollback.** Recovery is a new forward migration. Deliberate — see above.
- **Migrations are hand-written.** More typing, and the reviewer sees the truth.
- **The runner is ours to maintain.** It is small, and covered by tests including the two refusal paths.

## Consequences

- `pnpm --filter @lokdarpan/database migrate` applies pending migrations; `DATABASE_URL` is required and its absence exits `78` (`EX_CONFIG`), matching the API service.
- **Editing an applied migration is now a hard error.** Add a new one.
- The runner takes a `SqlClient` interface rather than a `pg.Client`, so its logic is unit-tested without a server; the schema itself is verified by applying it to a real PostGIS instance.
