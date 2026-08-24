# 19 — Screen → API Matrix

Every production screen, its endpoints, caching, pagination, auth, and offline behaviour.

**Legend** — ★ new backend requirement (`.docs/11-api/client-api-contract.md`) · Cache: `Q`=TanStack Query→MMKV, `D`=SQLite durable, `H`=HTTP/CDN, `L`=local-only, `—`=none · Auth: all `public` (anonymous) unless stated · Offline: `Full`=works from cache/durable · `Partial`=degraded, stated · `Cached`=cache only · `No`=explicitly unavailable, with copy.

| # | Screen | API | Data | Cache | Pagination | Auth | Offline |
|---|---|---|---|---|---|---|---|
| S-01 | Bootstrap | `GET /meta/client-support` ★ | client support manifest | Q 6 h | — | public | Full (cached config; never blocks) |
| S-02 | Onboarding | — | bundled | — | — | — | Full |
| S-03 | Language | — | bundled | — | — | — | Full |
| S-04 | Location primer | — | — | — | — | — | Full |
| S-05 | Choose area | `GET /units/:id/children`, `GET /search?type=unit` ★ | AdminUnit tree | Q 24 h + **bundled state/district seed** | page | public | Full (seed list ships in binary) |
| S-06 | Forced upgrade | `GET /meta/client-support` ★ | manifest | Q | — | public | Full (dismissible offline) |
| S-07 | Notification primer | — | — | — | — | — | Full |
| S-10 | Home | `GET /mobile/home?unitId&fy&lat&lon` ★ | unit, rollup, nearby counts, ≤3 observations, coverage | Q 15 m / 14 d | — | public | Cached + offline bar |
| S-08 | FY selector | `GET /meta/fiscal-years` ★ | FY list + coverage flags | Q 24 h | — | public | Cached |
| S-09 | Scope switcher | local + `GET /units/:id/children` | recents, saved units | L + Q | — | public | Full |
| S-11 | Updates inbox | `GET /mobile/watchlist/changes?since` ★ | change records | D | cursor | public | Full (local diffs) |
| S-13 | Search idle | `GET /search/suggest` ★ | suggestions | Q 60 s | — | public | Partial (history + saved only) |
| S-14 | Search results | `GET /search` ★ | grouped typed hits + facets | Q 0/1 h | cursor | public | Partial (local FTS5 over saved) |
| S-15 | No results | `GET /search` ★ (`zeroResultReason`) | — | — | — | public | Partial |
| S-16 | Search filters | facets from `GET /search` ★ | facet counts | Q | — | public | Partial |
| S-17 | Search history | local | queries | L | — | — | Full |
| S-18 | Explore map/list | `GET /tiles/{layer}/{z}/{x}/{y}.mvt`, `GET /mobile/map/features` ★ | tiles, features, `totalInBbox` | H 30 d + Q 10 m | viewport + 400 cap | public | Cached tiles + packs; un-cached area hatched |
| S-19 | Feature preview | — (properties from S-18 payload) | preview fields | in-memory | — | public | Full |
| S-20 | Cluster contents | `GET /mobile/map/cluster` ★ | members | Q 10 m | cursor | public | Partial (tile members only) |
| S-21 | Map filters | local + facets | — | L | — | — | Full |
| S-22 | Hierarchy browser | `GET /units/:id/children?fy&sort` 🔧 | children + per-child metric | Q 1 h / 14 d | page | public | Cached |
| S-23 | **Unit detail** | `GET /mobile/units/:id?fy` ★ | unit, ancestors, money in/out, counts, consistency, peers, observations, coverage | Q 15 m / 14 d; D if saved | — | public | Full if saved; else Cached |
| S-24 | Unit children | `GET /units/:id/children` 🔧 | children | Q | page | public | Cached |
| S-25 | Roll-up consistency | `GET /units/:id/consistency` | gap, gap %, missing children, observation | Q 1 h | — | public | Cached |
| S-26 | Peer comparison | `GET /units/:id/peers?metric` ★ | distribution, median, n | Q 1 h | — | public | Cached |
| S-27 | **Project detail** | `GET /mobile/projects/:id?fy` ★ | project, finance, priority+factors, observations, tender, contractor, intelligence, progress, provenance, coverage | Q 15 m / 14 d; **D if saved** | — | public | **Full if saved**; else Cached |
| S-28 | Money Trail | `GET /mobile/projects/:id/finance` ★ | chain, both variances, per-stage counts + provenance | Q 15 m; D if saved | — | public | Full if saved |
| S-29 | Ledger lines | `GET /projects/:id/ledger/{kind}` ★ | lines + provenance | Q 15 m; D if saved | cursor | public | Full if saved |
| S-30 | Ledger line | (from S-29) | one line | in-memory / D | — | public | Full if saved |
| S-30a | Value history | `GET /ledger/lines/:id/versions` ★ | record versions | Q 1 h | page | public | Cached |
| S-31 | Timeline | (from S-27) | events | Q; D if saved | — | public | Full if saved |
| S-32 | Progress history | `GET /projects/:id/progress` | snapshots | Q 1 h | page | public | Cached |
| S-33 | Road intelligence | (from S-27) | cost/km, model, coefficients, caveats | Q; D if saved | — | public | Full if saved |
| S-34 | Observations (project) | (from S-27, ≤10) + `GET /mobile/observations?projectId` ★ | observations | Q 15 m | cursor | public | Cached |
| S-35 | Observation detail | `GET /mobile/observations/:id` ★ | observation, arithmetic, inputs + sources | Q 1 h; D if saved | — | public | Full if saved |
| S-36 | Verification priority | (from S-27) | score, 6 factors, confidence | Q; D if saved | — | public | Full if saved |
| S-37 | Comparison picker | `GET /units/:id/peers` ★, `GET /search` ★ | peer candidates | Q | page | public | Partial |
| S-38 | Comparison result | `GET /mobile/compare?ids&metrics` ★ | entities + shared metrics + distributions | Q 1 h | — | public | Cached |
| S-39 | Project location | `GET /geo/units/:id`, project GeoJSON (small) | geometry | H + Q | — | public | Cached |
| S-40 | Tender detail | `GET /tenders/:id` | tender + provenance | Q 1 h; D if saved | — | public | Full if saved |
| S-41 | Tenders list | `GET /tenders?…` | tenders | Q 15 m | cursor | public | Cached |
| S-42 | Contractor detail | `GET /contractors/:id` 🔧 | canonical name, aliases + linkage confidence, stats, scope share | Q 1 h; D if saved | — | public | Full if saved |
| S-43 | Contractor tenders | `GET /contractors/:id/tenders` ★ | awards | Q 15 m | cursor | public | Cached |
| S-44 | Concentration context | `GET /units/:id/concentration?fy` ★ | HHI, top-k, labels | Q 1 h | — | public | Cached |
| S-45 | Scheme detail | `GET /schemes/:id` | scheme, allocations, projects | Q 1 h | page | public | Cached |
| S-46 | Schemes list | `GET /schemes?unitId` | schemes | Q 1 h | page | public | Cached |
| S-47 | Department detail | `GET /departments/:id` | dept, rollups, projects | Q 1 h | page | public | Cached |
| S-48 | Departments list | `GET /departments` | list | Q 24 h | page | public | Cached |
| S-49 | Observations (scoped) | `GET /mobile/observations?unitId&fy&type&severity` ★ | observations | Q 15 m | cursor | public | Cached |
| S-50 | Observation filters | facets | — | L | — | — | Full |
| S-51 | Coverage report | `GET /mobile/units/:id/coverage?fy` ★ | expected/present/missing + expected source + lastChecked | Q 1 h | — | public | Cached |
| S-52 | **Source sheet** | **none** — provenance embedded | provenance | with the figure (Q / D) | — | public | **Full** |
| S-53 | Source document | `GET /sources/:docId` | document record | Q 24 h | — | public | Cached |
| S-54 | Document viewer | `GET /sources/:docId/artifact` ★ **Range** | page bytes | FS if downloaded | page-by-page | public | Only if downloaded; size stated |
| S-55 | Lineage | `GET /figures/:id/lineage` ★ | chain + reverse index | Q 1 h | — | public | Cached |
| S-56 | Source registry | `GET /sources` 🔧 (+ operational status) | sources + health | Q 6 h | page | public | Cached |
| S-57 | Methodology | bundled + `GET /meta/methodology` ★ | formulas, assumptions | bundled | — | — | Full |
| S-58 | Ask | `POST /ai/ask` 🔧 (streamed, quota'd) | answer, citations, guardrail | Q ∞ per (scope,q,version) | — | public | **No** (history readable) |
| S-59 | Ask citations | (from S-58) | citations | Q | — | public | Cached |
| S-60 | Ask history | local | Q&A | L | — | — | Full |
| S-61 | Suggested questions | (from S-58 scope) | templates | bundled + Q | — | public | Full |
| S-62 | Saved | local + `GET /mobile/watchlist/changes` ★ | saved items + freshness | D | — | public | **Full** |
| S-63 | Collection | local | collection | D | — | — | Full |
| S-64 | Offline packs | `GET /mobile/packs/:unitId/manifest?since` ★ | manifest, sizes | D + FS | — | public | Full (manage/delete; download queued) |
| S-65 | Watch settings | local | per-item prefs | D | — | — | Full |
| S-66 | Profile | local (+ account API if enabled) | — | L | — | optional | Full |
| S-67 | Sign in | `POST /auth/*` (optional feature) | token → SecureStore | Secure | — | — | No |
| S-68 | Settings | local | prefs | L | — | — | Full |
| S-69 | Language | local | — | L | — | — | Full |
| S-70 | Data & storage | local | sizes | L/D/FS | — | — | Full |
| S-71 | Notifications | local | prefs | L | — | — | Full |
| S-72 | Accessibility | local | prefs | L | — | — | Full |
| S-73 | About | bundled + `GET /meta/dataset-version` | version info | Q | — | public | Full |
| S-74 | Legal & neutrality | bundled (`.docs/17-legal/legal-ethical-rules.md` verbatim) | — | — | — | — | Full |
| S-75 | Privacy | bundled | — | — | — | — | Full |
| S-76 | Methodology | bundled | — | — | — | — | Full |
| S-77 | Coverage & limitations | `GET /meta/coverage` ★ | coverage | Q 6 h | — | public | Cached |
| S-78 | Report data issue | `POST /feedback/data-issue` ★ | form | D (queued) | — | public | Full (queued, idempotent) |
| S-79 | Feedback | `POST /feedback` ★ | form | D (queued) | — | public | Full (queued) |
| S-80 | Licenses | generated at build | — | bundled | — | — | Full |

---

## Summary

| | Count |
|---|---|
| Screens using a ★ composite/new endpoint | 34 |
| Screens fully functional offline | 27 |
| Screens functional offline when the item is saved | 11 |
| Screens explicitly unavailable offline | 2 (S-58 Ask, S-67 Sign in) |
| Screens requiring auth | 1 (S-67, optional feature) |
| Screens with cursor pagination | 12 |
| **Screens whose figures are renderable without provenance** | **0** |

## Endpoints by criticality

**P0 (nothing works without them):** `/mobile/home` · `/mobile/units/:id` · `/mobile/projects/:id` · `/search` · `/search/suggest` · `/meta/dataset-version`
**P1:** `/mobile/map/features` · tiles · `/mobile/projects/:id/finance` · `/mobile/nearby` · `/units/:id/children` · `/sources/:docId/artifact` (Range) · `/meta/client-support`
**P2:** `/mobile/observations` · `/mobile/units/:id/coverage` · `/units/:id/peers` · `/mobile/compare` · `/mobile/watchlist/changes` · `/ai/ask`
**P3:** `/figures/:id/lineage` · `/sources` status · `/mobile/packs/*` · `/feedback/*`
