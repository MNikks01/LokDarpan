# ADR-009 — Testing: Jest + RNTL + MSW + Maestro, with guardrail gates

**Status:** Accepted · 2026-08-21 · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

Three failure classes here are not ordinary bugs (`.docs/14-testing/testing-strategy.md`): a **wrong number**, a **missing source**, and **accusatory language**. All three are public misstatements about government records. The backend also does not exist yet, so the API contract must be executable.

## Decision

**Jest** (unit, component, integration) · **React Native Testing Library** (queried by accessibility role/label) · **MSW** (network-layer mocking) · **`tsd`** (type-level tests) · **Maestro** (E2E) · plus a **guardrail suite** (G1–G8) that gates every merge.

## Alternatives considered

**Detox instead of Maestro.** Detox offers finer-grained synchronization (grey-box waiting on the app's internals) and is more established. **Maestro chosen because:**
- Flows are YAML and readable by non-engineers. This matters concretely here: the neutrality and empty-state flows are artefacts a **product or legal reviewer** should be able to read and verify against `.docs/17-legal/legal-ethical-rules.md`. A Detox spec in JavaScript is not that artefact.
- Setup and maintenance cost is far lower; CI flakiness is materially lower in practice.
- Our flows are navigation and reading, not complex async choreography — Detox's main advantage is not load-bearing for this app.

Trade-off accepted: less precise waiting control, occasionally requiring explicit waits. Reconsider if flakiness rises.

**Appium.** Rejected: slow, brittle, heavy infrastructure.

**Enzyme-style shallow rendering.** Rejected: tests implementation, not behaviour; incompatible with modern React; RNTL's role/label queries additionally give us accessibility verification for free.

**Nock / manual fetch mocks instead of MSW.** Rejected: MSW intercepts at the network layer, so repositories, TanStack Query, Zod validation, and mappers are all genuinely exercised. Mocking the repository would skip precisely the layer where contract drift bites.

**Snapshot-heavy testing.** Rejected as a strategy. Full-tree snapshots rot and get rubber-stamped. Snapshots are used narrowly: layout regression at 100/150/200% text scale on representative screens.

**A global coverage percentage.** Rejected as a target. A blanket number drives tests written for coverage rather than confidence. Instead: **`domain/` ≥ 95% branches, enforced** — that is where money arithmetic, variance labelling, fiscal-year parsing, and formatting live — and meaningful tests everywhere else with no numeric gate.

## The distinctive parts

**1 · Contract tests are the most valuable tests in the repo.** With no backend, `data/contracts/` Zod schemas + recorded fixtures **are** the API specification (`.docs/11-api/client-api-contract.md`). Negative cases are as important as positive ones: money as a JS number → rejected; missing `provenance` → rejected; unknown enum → typed error, not a crash. When the backend ships, a nightly job records live responses and diffs them against the committed fixtures, **opening a PR on drift** — so schema drift becomes a review item, not a production incident.

**2 · Type-level tests via `tsd`.** `<Figure>` without `provenance` and `<Observation>` with a string literal must both **fail to compile**. These assertions are how `.docs/17-legal/legal-ethical-rules.md` rules 4 and 5 become structural rather than reviewed (`.docs/10-mobile/mobile-architecture.md` §2–3).

**3 · The guardrail suite blocks merges.** G1 neutrality lint across all locales · G2 provenance enforcement · G3 palette (no red in any band) · G4 accessibility · G5 privacy (no content in telemetry) · G6 mock isolation · G7 performance budgets · G8 security. Details in `.docs/14-testing/testing-strategy.md` §6. These are not "nice to have" checks — G1 and G2 are the automated expression of a binding legal-ethical document.

## Trade-offs

- Maestro's coarser synchronization may need explicit waits.
- Contract fixtures must be maintained; automated drift detection makes that cheap.
- The guardrail suite adds ~2 minutes to PR CI. Acceptable for what it prevents.
- Device-farm E2E has real cost; mitigated by running full E2E on merge and pre-release, emulator smoke on PRs.

## Consequences

- The correctness-critical layer (`domain/`) runs in plain Node — fast, and the tests are readable as a specification of Indian money formatting and variance semantics.
- RNTL's role/label queries mean an accessibility regression fails a functional test, not just an audit.
- A neutrality violation cannot reach a release branch.
- The app is buildable and testable before the backend exists.
