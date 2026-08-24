# ADR-014 — Dependency injection with tsyringe, in `services/api` only

**Status:** Accepted · 2026-08-24

## Context

The engineering standards call for `tsyringe` "where DI provides genuine value". The question is _where_ — the repository has two candidate homes, and they are not equivalent.

## Decision

**Use tsyringe in `services/api`. Do not use it in `apps/web`.**

The API has real dependency graphs worth inverting: `ProjectService` depends on a `ProjectRepository` _port_, not on a Postgres driver; config and logger are singletons; adapters will be swapped (in-memory today, Postgres tomorrow) with no change to callers. The composition root in `container/index.ts` is the only module that knows which concrete class satisfies which port.

## Why not in the web client

1. **RSC has no request-scoped container.** Server Components render per-request across a boundary tsyringe was not designed for; a module-scoped container becomes shared mutable state across requests.
2. **`emitDecoratorMetadata` fights SWC**, and a careless import pulls `reflect-metadata` into the _client_ bundle, against a 90 KB budget ([`../02-architecture/web-architecture.md`](../02-architecture/web-architecture.md)).
3. **There is nothing to inject.** The web app has no repositories, no clients, no I/O — data arrives through RSC `fetch`. DI there would be a pattern demonstration, which the standards explicitly rule out.

If `apps/web` later grows genuine server-side services, revisit — but a plain factory module will probably remain sufficient.

## Alternatives considered

**No DI anywhere; manual construction in a composition module.** Honestly, this would work today: the graph is four objects deep. Rejected because the graph grows quickly once ingestion, entity resolution and analytics services land, and retrofitting DI across an established codebase is far more expensive than starting with it in the one place it belongs.

**A different container (Awilix, InversifyJS).** Awilix avoids decorators entirely, which would sidestep the `emitDecoratorMetadata` friction. Rejected narrowly: tsyringe was specified, is smaller, and the decorator cost is confined to a service that already needs a build step.

**DI in every package.** Rejected. `@lokdarpan/money` and `@lokdarpan/neutrality` are pure functions and values with no I/O. Injecting them would add indirection and remove nothing.

## Trade-offs

- `experimentalDecorators` and `emitDecoratorMetadata` are enabled for `services/api` only, and `reflect-metadata` is imported once, at the entrypoint.
- Registration is manual rather than auto-scanned — deliberate, since implicit registration makes the graph hard to trace.
- Tests build a **child container** per suite, so an override in one test cannot leak into another.

## Consequences

- Business logic is unit-testable with a stub repository and no database.
- Replacing the in-memory adapter with Postgres touches one line of the composition root.
- The decorator/runtime cost never reaches the browser.
