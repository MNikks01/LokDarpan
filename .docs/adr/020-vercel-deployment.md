# ADR-020 — Vercel (Hobby) for the web deployment; the API travels with it

**Status:** Accepted · 2026-08-25 · Supersedes nothing; the hosting shape was an open Sprint 0 `OPS` item.

## Context

The platform needed somewhere to run. Vercel's free tier was chosen for now.

Vercel runs **serverless functions**, not long-lived processes. `services/api` is a `node:http` server with `server.listen`, SIGTERM draining, a connection pool and a startup assertion. It has no home there.

[`011-web-framework.md`](./011-web-framework.md) anticipated this and set the constraint that governs the decision:

> Next.js is Vercel-led, and some features are best on Vercel. Mitigated: **the app must remain deployable to a self-hosted Node runtime, and that must be verified in CI, not assumed. A public-interest project should not be unable to leave its host.**

## Decision

**One Vercel deployment serving both the site and the REST API, with `services/api` retained as the self-hosted target.**

`/api/v1/*` is served by Next.js Route Handlers in `apps/web`. The REST contract from [`012-web-api-strategy.md`](./012-web-api-strategy.md) is unchanged — same paths, same envelope, same `datasetVersion` in `meta` — so the researcher-facing API promised for Sprint 8 still has a surface, and RSC still fetches over HTTP rather than reaching into the database from a page.

To make one implementation serve both runtimes, the service layer moved out of `services/api`:

| Package               | Holds                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `@lokdarpan/domain`   | `AdminUnit`, the repository **port**, `UnitService`, `parseLevel`, `singleDatasetVersion` |
| `@lokdarpan/errors`   | `AppError`, the closed error model, `toEnvelope`                                          |
| `@lokdarpan/database` | `PostgresAdminUnitRepository`, the migration runner                                       |

**These carry no decorators.** [`014-dependency-injection.md`](./014-dependency-injection.md) keeps tsyringe out of `apps/web`, and a shared layer annotated with `@injectable()` would smuggle it back in. `services/api` bridges the two in one file (`unit.module.ts`) using factories; the Route Handlers construct the same classes directly.

`UnitService` reports contract violations through a **callback** rather than owning a metrics registry, because the two runtimes can count them in different ways.

## What does not work on Vercel, stated plainly

**`/metrics` is not served from `apps/web`.** The registry from [`018-telemetry-without-identifiers.md`](./018-telemetry-without-identifiers.md) holds counters in memory. A serverless isolate is frozen between invocations and a scrape reaches one arbitrary instance, so the numbers would be meaningless — worse than absent, because a dashboard would display them. Observability on Vercel is the structured stdout stream ([`019-log-shipping.md`](./019-log-shipping.md)), which Vercel captures, plus Vercel's own request analytics. `services/api` still serves `/metrics` for the self-hosted shape, where it is correct.

**Ingestion does not run on Vercel.** This is a security boundary, not a convenience: ETL writes to the ledger and needs the **owner** credential, while the web deployment must only ever hold the read-only one (migration `0002`). Putting a cron route in this project would place write credentials in the same environment as the public site and undo that separation. Ingestion runs from a trusted environment — a maintainer's machine today, a scheduled job later.

Vercel Hobby's cron limits (one run per day, short function timeout) would not carry a 677,367-row village ingest regardless.

**Connection pooling.** A `pg.Pool` per isolate against a free-tier connection cap is an outage. The repository takes `runtime: "serverless"`, which caps the pool at one connection and shortens the idle timeout, and Neon's **pooled endpoint** fans in.

## Hobby-plan terms

Vercel's Hobby plan is for **non-commercial, personal use**. A solo public-interest project fits; **donations, an organisation account, or sponsor placement would require Pro.** Recorded because this project is careful about legal questions elsewhere, and a terms breach would be an avoidable own goal.

## Alternatives considered

| Option                                               | Why not                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RSC reads Postgres directly**                      | Fewest moving parts, but abandons the REST contract `012` chose deliberately and removes the API surface Sprint 8 promises researchers.                                               |
| **Keep `services/api`, host it separately**          | No code change, but two platforms, two free-tier limits, cross-region latency on every render, and free API hosts sleep when idle — a first page load after quiet would be very slow. |
| **A different host entirely** (Fly, Railway, Render) | Would run `services/api` unchanged. Reconsider when the free tier stops fitting; nothing here forecloses it.                                                                          |

## Consequences

- **Self-hosted deployability is now load-bearing, not theoretical.** `services/api` is the escape hatch `011` demands, and it must keep working — it is exercised by the same shared service layer and the same tests.
- **Two composition roots exist** — `services/api/src/modules/units/unit.module.ts` (DI) and `apps/web/src/server/container.ts` (plain construction). A new dependency must be wired in both. That duplication is the price of running on a platform that has no long-lived process.
- **`DATABASE_URL` on Vercel must be the read-only user.** The startup assertion that protected this in `services/api` cannot run per-invocation cheaply; the guarantee rests on migration `0002` and on the deployment setting the right credential.
- Moving off Vercel means deploying `services/api` and pointing `API_BASE_URL` at it. The Route Handlers become redundant rather than blocking.
