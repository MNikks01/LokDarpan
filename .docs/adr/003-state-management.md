# ADR-003 — Client state: Zustand (four small slices)

**Status:** Accepted · 2026-08-21

## Context

Almost all state in this app is **server state** — a read-only public ledger, owned by TanStack Query (`adr/004`). What remains is small: the selected scope (admin unit + fiscal year), map view state, user settings, and offline-pack progress. Two of these must persist across launches; one must be read by nearly every query key.

## Decision

**Zustand**, with four slices: `scopeStore` (persisted), `settingsStore` (persisted), `mapStore` (session), `offlineStore` (persisted, backed by SQLite). Persistence via a small MMKV adapter. Components subscribe with **selectors**, never to whole stores.

Everything else stays where it belongs: server data in TanStack Query, filters and sort in route params, transient UI in `useState`.

## Alternatives considered

**Redux Toolkit.** Rejected. The app has no complex cross-cutting client state, no undo/redo, no optimistic mutation choreography — the ledger is read-only, so there is nothing to be optimistic about. RTK would add a store, middleware, slices, action creators, and a mental model for state that fits in ~150 lines. Its real strengths (devtools time-travel, strict update discipline, middleware for complex async) address problems this app does not have. Choosing it because it is the default in large React codebases would be exactly the cargo-culting the brief warns against.

**React Context + `useReducer`.** Rejected: context has no selector granularity, so a scope change re-renders every consumer subtree — measurable on the reference device with four tab stacks mounted. Workarounds (splitting into many contexts, `use-context-selector`) reconstruct Zustand badly.

**Jotai / Recoil (atomic).** Reasonable fit, genuinely good ergonomics. Rejected on the margin: our state is a handful of coarse, coherent objects (a scope, a settings blob) rather than many fine-grained independent atoms. Zustand's store-with-selectors matches that shape more directly, and its persistence and testing story is simpler.

**TanStack Query alone, with scope in query keys.** Rejected: scope is *user intent*, not fetched data. Putting it in the query cache confuses two lifetimes (a cache may be evicted; a user's chosen district may not) and makes persistence awkward.

**MobX.** Rejected: observable/proxy mutation model is a different paradigm from the rest of the codebase; larger runtime.

## Why the state is this small (the real decision)

Most React Native apps have large client stores because they hold server data. Here the read-only ledger, cursor-paged feeds, and stale-while-revalidate caching are all owned by TanStack Query, and filters live in route params for shareability. That leaves four slices. **Recognising this is what makes a heavyweight state library unnecessary** — the architecture, not the library choice, is what keeps state management small.

## Trade-offs

- **Less structure than Redux.** Mitigated by convention: one file per slice, actions colocated, selectors exported, no cross-slice imports.
- **Devtools are thinner.** Acceptable — the state is small enough to inspect directly, and the interesting state (server data) has TanStack Query devtools.
- **Persistence is hand-wired.** ~30 lines for an MMKV adapter; explicit and testable.

## Consequences

- Selector subscriptions keep a scope change from re-rendering four tabs (`.docs/14-performance.md`).
- Stores are plain functions — unit-testable with no provider or harness.
- Bundle cost is ~1 KB.
- Guardrail: if a slice grows past ~150 lines or acquires cross-slice orchestration, revisit this ADR rather than quietly growing a bespoke framework.
