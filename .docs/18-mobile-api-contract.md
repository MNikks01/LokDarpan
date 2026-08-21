# 18 — Mobile API Contract

**Status: a requirements document, not an implementation.** No backend exists yet. This states what the mobile client needs from the API, marking clearly what `docs/10` already specifies, what must change, and what must be added. It deliberately does not invent implementation details for the server.

Legend: ✅ exists in `docs/10` · 🔧 exists but must change · ★ **new requirement**

---

## 1 · Conventions

Inherited from `docs/10`: `{ data, meta }` envelope, `{ error }` on failure, provenance embedded in every fact, `meta.datasetVersion` + `meta.asOf` on every response, ISO-8601 UTC, `?version=N` pinning.

### Changes required for mobile

| # | Change | Reason |
|---|---|---|
| 🔧 **Money as a decimal string** | `"amountInr": "900000000.00"` — not a JSON number | `NUMERIC(20,2)` exceeds `Number.MAX_SAFE_INTEGER` at national aggregate scale and fails **silently** (`00-document-audit` C3). The client parses to `bigint` paise |
| 🔧 **`display` is optional and secondary** | `inr` is authoritative; the client formats per locale | Server-formatted strings cannot be localized to Marathi/Hindi and cannot reflow under OS font scaling (C2) |
| 🔧 **Both variances, always** | `releaseVarianceInr` + `releaseDeviationPct` **and** `allocationVarianceInr` + `allocationDeviationPct`. A field named `variance` must not exist | `05`/`10` are ambiguous and mutually inconsistent (C1). A mislabelled variance is a neutrality failure |
| 🔧 **Three separate confidences** | `extractionConfidence`, `linkageConfidence`, `scoreConfidence` | One word currently means three different risks (C4) |
| 🔧 **Cursor pagination on feeds** | `?cursor=&limit=`; `meta.nextCursor`; `409 CursorStale` when the cursor's `datasetVersion` is superseded | Offset pagination duplicates and skips rows against a live dataset (C6) |
| 🔧 **No inline geometry** | Boundaries via MVT only; GeoJSON strictly opt-in with a simplification tolerance | A district `MultiPolygon` inline is a broken mobile screen (C5) |
| 🔧 **`/units/:id` is a strict superset of `/districts/:id`** | The client uses `/units` exclusively | Two code paths for "a place" is the fastest route to an unmaintainable app (C7) |
| ★ **Provenance carries page anchors** | `pageLocator`, `page`, `bbox` | Without them, "tap a figure → land on the page it came from" is impossible (C8) |
| ★ **Structured, localizable neutral text** | `{ key, params, rendered.en }` for every `observation` | Neutral language must survive translation; the client may not compose it (C13 / M6) |
| ★ **Mobile rate tier** | Per-install anonymous bucket, or a substantially raised tier keyed on `X-Client-Build` | Indian carrier CGNAT makes per-IP limits throttle the app's users collectively (C9) |
| ★ **`X-Request-Id` echoed** in every response and error | Maps a user report to a server log with no user identity (`.docs/16-observability.md`) |

### Error codes

`docs/10`'s set plus: `409 CURSOR_STALE` ★, `426 UPGRADE_REQUIRED` ★, `503 DATASET_REBUILDING` ★ (with `Retry-After`). Every error carries `requestId`.

### Caching

`ETag: "v{datasetVersion}"` on every GET; `If-None-Match` → `304`. Composite endpoints return one ETag for the whole payload. `Cache-Control: public, max-age=300, stale-while-revalidate=86400` on entity reads; tiles are immutable per version.

---

## 2 · The Mobile BFF ★ (`M3` — the central new requirement)

A thin, read-only composition layer at `/mobile/v1/*` that assembles existing service outputs into **screen-shaped payloads**.

**Why it is necessary.** A project screen built from `docs/10` needs `/projects/:id` + `/projects/:id/finance` + `/projects/:id/timeline` + `/projects/:id/risk` + `/anomalies?projectId=` + `/tenders/:id` + `/contractors/:id` ≥ **7 round trips**. At 300 ms RTT that is over two seconds of pure latency before anything renders, seven independent failure modes, seven ETags — and, worst, the possibility of rendering figures from two different `datasetVersion`s side by side, which is a traceability defect, not a performance one.

One request gives one latency, one failure mode, one ETag, and **one `datasetVersion` across every figure on the screen**.

**What the BFF must not be:** a place for business logic. It composes, projects, and caps. Every number it returns is computed upstream by the analytics tier (`docs/06`/`07`/`08`) with its provenance intact. It must never compute a variance, a median, or a score.

---

## 3 · Endpoints

### Meta

| Method & path | Status | Notes |
|---|---|---|
| `GET /meta/client-support` | ★ | `{ minBuild, recommendedBuild, message?, storeUrl }`. 6 h cache. Never blocks launch (`00-document-audit` C11) |
| `GET /meta/dataset-version` | ✅ | Tiny; polled ≤ every 5 min on foreground. The invalidation trigger |
| `GET /meta/fiscal-years` | ★ | Years + a per-year coverage indicator for the current scope |
| `GET /meta/coverage` | ★ | What the platform currently covers (states, domains, phases) — powers S-77 and every E2 empty state |

### Search ★ (M1 — absent from `docs/10` entirely)

```text
GET /search/suggest?q=&scope=&limit=8
GET /search?q=&types=&unitId=&fy=&filters=&cursor=&limit=25
```

Requirements (rationale in `.docs/08-search-experience.md`): exact-ID match ranks first, always · bidirectional Devanagari↔Latin transliteration · typo tolerance including official renames ("formerly known as") · **contractor alias matching, with the matched alias returned** · acronym expansion (PMGSY, ZP, GP, NH/SH/MDR/ODR) · results **grouped by type** with a disambiguating subtitle per result · facet counts for the filter sheet · a `zeroResultReason` of `uncovered | no_match | filtered` so the client can render the correct one of three empty states.

### Nearby ★ (M2)

```text
GET /mobile/nearby?lat=&lon=&radiusKm=&types=&fy=
```
Returns the resolved admin unit for the point, plus counts and summary finance for units, projects and assets within the radius. **Coordinates must not be logged with any identifier** (`.docs/13-mobile-security.md`).

### Composite screen endpoints ★ (M3)

| Endpoint | Serves | Contents | Budget |
|---|---|---|---|
| `GET /mobile/home?unitId&fy&lat&lon` | S-10 | scope unit + rollup finance + nearby counts + ≤3 scoped observations + coverage summary | 20 KB |
| `GET /mobile/units/:id?fy` | S-23 | unit + ancestors + money-in (allocations + transfers by scheme) + money-out + asset counts by domain/status + roll-up consistency + peer summary + ≤5 observations + coverage | 40 KB |
| `GET /mobile/projects/:id?fy` | S-27 | project + finance chain (both variances) + verification priority with all six factors + ≤10 observations + tender + contractor summary + road/asset intelligence + ≤12 progress snapshots + provenance for every figure + coverage | **60 KB** |
| `GET /mobile/projects/:id/finance?fy` | S-28 | full chain + per-stage record counts + both variances + status + per-stage provenance | 25 KB |
| `GET /mobile/compare?ids=&metrics=` ★ (M9) | S-38 | 2–4 entities on a shared metric set + the peer distribution each sits in | 30 KB |
| `GET /mobile/map/features?bbox&z&filters&limit=400` | S-18 | features with enough properties to render the S-19 preview **without a further request**; `meta.totalInBbox` so truncation is announced, never silent | 80 KB |
| `GET /mobile/map/cluster?clusterId&bbox&z&cursor` | S-20 | cluster members, cursor-paged | 25 KB |
| `GET /mobile/observations?unitId&projectId&fy&type&severity&cursor` | S-49 | neutral observations, cursor-paged, each with evidence refs | 25 KB |
| `GET /mobile/units/:id/coverage?fy` ★ (M11) | S-51 | `{ expected[], present[], missing[{ recordType, expectedSource, lastCheckedAt }] }` | 15 KB |

Caps (≤3, ≤5, ≤10, ≤12, ≤400) are contractual, not advisory — full lists live behind their own paged endpoints.

### Hierarchy

| Method & path | Status | Notes |
|---|---|---|
| `GET /units/:id/children?fy&sort` | 🔧 | Must carry a per-child headline metric, otherwise a list of names is not a usable screen |
| `GET /units/:id/rollup?fy&scheme` | ✅ | |
| `GET /units/:id/consistency?fy&scheme` | ✅ | Must include which children are missing from the sum, not only the gap |
| `GET /units/:id/peers?metric&fy` | ★ | Sibling distribution, median, `n`, this unit's position; **withheld with `low_sample` below n=8** (`docs/06` §4) |

### Ledger, procurement, entities

`GET /projects/:id/ledger/{allocations|releases|expenditures}?cursor` ★ (cursor-paged; each line with full provenance) · `GET /ledger/lines/:id/versions` ★ (record history — `docs/15` rule 9) · `GET /tenders/:id` ✅ · `GET /contractors/:id` ✅ 🔧 (must return aliases **with their linkage confidence**) · `GET /contractors/:id/tenders?cursor` ★ · `GET /schemes/:id` ✅ · `GET /departments/:id` ✅.

### Sources

| Method & path | Status | Notes |
|---|---|---|
| `GET /sources` | ✅ | The registry, **with operational status per source** ★ (last fetch, link health, record count) — powers S-56 |
| `GET /sources/:docId` | ✅ | |
| `GET /sources/:docId/artifact` | ★ (M5) | **Must support HTTP `Range`.** Opening page 42 of an 80 MB scanned PDF over 4G is otherwise impossible |
| `GET /sources/:docId/figures?cursor` | ★ | Every figure extracted from this document |
| `GET /figures/:id/lineage` | ★ | Powers S-55, including the reverse index: which derived metrics used this figure |

### Ask

`POST /ai/ask` 🔧 — must **stream** (SSE/chunked) with named retrieval stages, must carry a deterministic idempotency key so an identical `(scope, question, datasetVersion)` is cache-served and **does not consume quota**, and must enforce a per-install quota with the remaining count returned (`00-document-audit` C10, M10). Response shape per `docs/10` plus `refusedClaims` and `guardrail`.

### Offline & watchlist

`GET /mobile/packs/:unitId/manifest?since` ★ (M4) — a pack manifest, delta against a prior `datasetVersion`.
`GET /mobile/watchlist/changes?ids=&since=` ★ (M7) — given a set of entity ids and a version, return **what changed**, with old and new values and the source of the change. See §5.

### Feedback

`POST /feedback/data-issue` ★ — `docs/15`'s right-of-reply channel. Accepts an idempotency key so a queued offline submission cannot duplicate. The only write the app makes.

---

## 4 · Provenance object (contractual)

As specified in `.docs/10-source-traceability.md` §Provenance. It travels **with every fact**, never as a separate fetch. **A fact without provenance is a contract violation**: the client suppresses the figure and logs it (`.docs/04-data-flow.md` §12). This is `docs/15` rule 5, enforced at the wire boundary.

---

## 5 · Watchlist changes ★ — a privacy-shaped design

The obvious implementation is server-side subscriptions: the client registers `(deviceToken, projectId)` pairs and the server pushes. That creates a database of *which anonymous person is monitoring which government contract* — for an RTI activist, a genuinely sensitive dataset that would not otherwise exist.

**Preferred design:** the watchlist stays on the device. The client periodically asks:

```text
GET /mobile/watchlist/changes?ids=501,884,1203&since=137
→ [{ entityId, entityType, changeKind, field, previousValue, newValue,
     sourceDocumentId, changedAt, datasetVersion }]
```

The server sees a set of ids in a request it does not retain; it stores no subscription. The client schedules a background fetch every ≥6 h (`.docs/11-offline-strategy.md`) and raises a **local** notification.

Cost: no real-time push, and a request whose id list grows with the watchlist (batched, capped at 200 ids, and cheap because it is a version diff). Analysis and the opt-in push alternative: `.docs/22-notifications.md`.

---

## 6 · Auth, rate limits, versioning

- **Anonymous public tier.** The app ships no API key (`adr/008-authentication.md`, `.docs/13-mobile-security.md` §2).
- **Rate limiting must not be per-IP for mobile clients** (C9). Required: a per-install anonymous token bucket that is never joined to request content, or a raised tier keyed on `X-Client-Build`. `429` must carry `Retry-After`.
- Versioning: `/api/v1` and `/mobile/v1`. Additive changes only within a version. A breaking change requires a new prefix **and** a `minBuild` raise, and old clients must keep working until store adoption crosses an agreed threshold — app-store clients live on devices for years.
- Optional account (sync only) uses a bearer token from SecureStore; there are no other authenticated endpoints.

---

## 7 · Backend requirement summary

Ordered by what blocks the mobile build:

| Priority | Requirement | Blocks |
|---|---|---|
| **P0** | Mobile BFF composite endpoints (M3) | Every entity screen |
| **P0** | Search + suggest (M1) | The Search tab entirely |
| **P0** | Money as decimal string; both variances; three confidences (C1–C4) | Correctness of every figure |
| **P0** | Provenance page anchors (C8) | Source traceability, the core promise |
| **P0** | Mobile rate tier (C9) | The app being usable on Indian carriers at all |
| **P1** | Nearby (M2) | The primary citizen journey |
| **P1** | Cursor pagination (C6) | Every feed |
| **P1** | No inline geometry (C5) | Unit screens |
| **P1** | `Range` support on artifacts (M5) | Document viewer |
| **P1** | Structured neutral text (M6) | Marathi/Hindi |
| **P1** | `/meta/client-support` (C11) | Long-term maintainability |
| **P2** | Watchlist changes (M7) | Saved-item updates |
| **P2** | Delta/`since` (M4) | Offline packs |
| **P2** | Coverage summary (M11) | Honest empty states |
| **P2** | Peers + compare (M9) | Comparison journeys |
| **P2** | Streaming Ask + quota (C10, M10) | Ask UX and cost |
| **P3** | Source operational status | S-56 |
| **P3** | Lineage + reverse index | S-55 |

**Until P0 lands, the mobile app is built against `data/fixtures/`** with Zod contract tests as the executable specification (`.docs/17-testing-strategy.md` §3). That is deliberate: the contract tests *are* the API spec, in code, and the day the backend appears they become drift detection.
