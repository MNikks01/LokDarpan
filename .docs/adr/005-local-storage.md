# ADR-005 — Local storage: MMKV + SQLite, split by guarantee

**Status:** Accepted · 2026-08-21 · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

Four distinct storage needs (`.docs/10-mobile/offline-strategy.md`):

1. A **query cache** persisted across launches so a cold start with no network still renders (LRU, evictable).
2. **Saved items** with full offline bundles — *must never be silently evicted*, and must be queryable (list, filter, join, diff against a new dataset version).
3. **Offline packs** — unit trees, project indexes, map tiles.
4. **Secrets** — only if the optional sync account exists.

The requirements of (1) and (2) are opposites: the cache must be free to evict; the saved bundle must never be.

## Decision

| Need | Store | Why |
|---|---|---|
| Query cache, preferences, small state | **MMKV** (`react-native-mmkv`) | Synchronous, ~30× faster than AsyncStorage, JSI-based (no bridge). Synchronous read is what allows scope and cache rehydration before first paint, holding the 1.2 s cold-start budget |
| Saved items, bundles, offline packs, search index, queued reports | **SQLite** (`expo-sqlite` + **Drizzle ORM**) | Needs querying, joins, ordering, FTS5 for offline search, and durable non-evictable storage |
| Documents, map tile packs | **Filesystem** (`expo-file-system`) | Large binaries; per-file size accounting and deletion |
| Tokens (optional account) | **`expo-secure-store`** | Keychain / Android Keystore. **Never MMKV or AsyncStorage** |

## Alternatives considered

**AsyncStorage for everything.** Rejected: asynchronous (cannot rehydrate before first paint), slow, no querying, historically size-limited on Android, and no durability distinction between a cache entry and a user's saved evidence.

**MMKV for everything.** Rejected: a key-value store cannot answer "all saved projects in Pune district sorted by last update", cannot do FTS for offline search, and cannot express the eviction distinction. Emulating queries by scanning keys is how a 200-item saved list becomes a 400 ms screen.

**SQLite for everything.** Rejected: asynchronous, so the synchronous first-paint rehydration disappears and cold start regresses. Overkill for `theme = 'dark'`.

**WatermelonDB.** Strong for large offline datasets with sync. Rejected: its value is a **bidirectional sync engine**, and this app has no writes to sync (the ledger is read-only, `.docs/11-api/api-documentation.md`). Adopting a sync framework where there is nothing to sync is unnecessary complexity plus a lazy-loading model we do not need.

**Realm / MongoDB Realm.** Rejected: heavy native dependency, larger binary, licensing and vendor considerations that sit poorly with an auditable public-interest codebase.

**op-sqlite instead of expo-sqlite.** Faster (JSI). Reconsider if profiling shows SQLite is a bottleneck; `expo-sqlite` is chosen first for managed-workflow simplicity and one fewer config plugin. Drizzle abstracts the driver, so switching is contained.

**WatermelonDB/Realm-style encryption at rest.** Rejected deliberately: the stored data is public government information. Encrypting it would imply a protection the app cannot actually provide against a compromised device, and would add key-management complexity for no threat in the model (`.docs/12-security/mobile-security.md` §1). The genuinely sensitive artefact — the **watchlist** — is protected by never leaving the device, not by local encryption.

## The two-tier rule (the decision that matters)

> **Tier 1 (MMKV/query cache) may be evicted at any time. Tier 2 (SQLite saved items) may be deleted only by the user.**

A single unified store forces a choice between an unbounded cache and silently losing a journalist's saved project. Neither is acceptable, so the tiers are separate by construction. On an OS low-storage warning the app evicts Tier 1 and the tile cache **only**, and tells the user what it did.

## Trade-offs

- **Two stores to reason about.** Mitigated by the repository layer: features never touch a store directly, and the tier is chosen inside `LocalDataSource`.
- **Drizzle migrations must be maintained.** Standard, versioned, tested.
- **MMKV is a native module.** Fine under Expo config plugins; no eject.

## Consequences

- Cold start can rehydrate synchronously → 1.2 s first paint (`.docs/02-architecture/performance.md`).
- "Saved means saved," including provenance, so traceability survives offline (`.docs/01-product/source-traceability.md`).
- Offline search via SQLite FTS5 over saved and recently-viewed items.
- Queued data-issue reports survive process death and flush idempotently.
- Storage is user-visible and per-item deletable (S-70) — a phone with 16 GB of storage cannot host an app that quietly grows.
