# 24 — Pre-Implementation Questions, Answered

The fifteen questions that must be answered before any code is written. Answers are decisions, with their reasoning and their pointer into the specification.

---

### 1 · What are the primary user journeys?

Twelve, in `.docs/01-product/user-journeys.md`. Three carry the product:

- **J3 — Follow allocation → release → expenditure.** The central promise. If this is not excellent, nothing else matters.
- **J10 — Read the source document behind a number.** The credibility mechanism. Without it, the app is an unverifiable dashboard.
- **J1 — Discover spending near me.** The acquisition and citizen journey; the only one that works with no prior knowledge.

J4 (unusual cost) and J9 (missing records) are the journalist/RTI journeys and carry the highest neutrality risk.

---

### 2 · What are the five most important screens?

1. **S-27 Project detail** — where the money becomes an asset.
2. **S-23 Unit detail** — one level-agnostic screen replacing the six dashboards of `.docs/01-product/dashboard-design-legacy.md`; the biggest structural decision in the app.
3. **S-52 Source sheet** — reachable from every figure; the product's promise, executed.
4. **S-28 Money Trail** — the signature interaction.
5. **S-10 Home** — an intent launcher, not a dashboard; the frame everything else is read through.

S-54 (document viewer) is sixth and is the hardest to get right.

---

### 3 · What must appear above the fold?

| Screen | Above the fold |
|---|---|
| Home | Scope, "near you" count + money, the four-panel scope summary |
| Unit | Name, level, ancestors, **money in / money out with both variances** |
| Project | Name, category, status, **the complete Money Trail** |
| Money Trail | Allocated → Released → Utilized with both variances and the status |
| Source sheet | The value, the authority, the page locator, the confidence caveat |

**Rule:** every one of these has at least one source affordance visible without scrolling. A screen whose first viewport contains a figure but no source chip has failed.

---

### 4 · What is hidden behind drill-down?

Ledger lines · value/version history · full timeline · full progress history · road-model coefficients · the six risk factors · the observation arithmetic · peer distributions · the document itself · lineage · sub-unit lists · full source registry.

**Principle:** the *conclusion and its provenance* are on the surface; the *evidence and the arithmetic* are one tap away. Never the reverse — a screen that shows a formula before it shows the number is a spreadsheet, not a product.

---

### 5 · What data does each screen need?

`.docs/11-api/screen-api-matrix.md` (endpoints, caching, pagination, offline) and `.docs/05-data-model/screen-data-matrix.md` (entities). The invariant across both: **no screen renders a figure without its provenance**, and there are zero exceptions.

---

### 6 · What can be cached?

Everything except an AI answer's generation. Three tiers (`.docs/10-mobile/offline-strategy.md`):

| Tier | Store | Guarantee |
|---|---|---|
| Ephemeral | TanStack Query → MMKV, 24 MB LRU | "What you looked at recently opens" |
| Durable | SQLite, user-controlled | "Saved means saved — including provenance" |
| Binary | Filesystem | "You chose this; it stays" |

Invalidated by `datasetVersion` via ETag. **Stale data is marked, never evicted** — eviction would turn a version bump into an offline outage.

---

### 7 · What happens offline?

The app opens, from cache, with an honest label. 27 screens fully functional; 11 more fully functional for saved items; 2 explicitly unavailable (Ask, Sign-in). Source traceability works completely offline for any cached figure — only the document body needs a connection.

**The rule that matters:** *"we don't have this because you're offline"* and *"the government hasn't published this"* are different states, with different copy and different icons (`.docs/01-product/state-design.md` R2). Conflating them turns a dropped connection into an implied accusation against a government body.

---

### 8 · What happens when data is incomplete?

- A null financial value renders `MissingData` with its reason, the **expected source**, and when it was last checked. **Never `₹0`, never blank, never a dash** (R1).
- **No variance is computed across a missing stage.** Status becomes `insufficient_data` — a first-class visual state, distinct from both "consistent" and "needs verification".
- Every empty state carries the sentence: *"This does not mean no money was spent — it means the record has not been published or collected yet."*
- Coverage is a **first-class entity**, on 10 screens, not an error condition.
- Deviations and coverage gaps are **never mixed in one list** (`.docs/01-product/dashboard-design-legacy.md`).

---

### 9 · How does a user verify every number?

```text
figure → 🔗 (one tap, zero latency) → Source sheet
       → page-anchored document (HTTP Range)
       → lineage: source → extraction → normalization → version → derived metrics
```

Provenance is **embedded in every payload**, not fetched, so the chain is instant and works offline. A figure that arrives without provenance is **not rendered** — enforced at the type level by `<Figure>` and at the data layer by the mapper (`.docs/10-mobile/mobile-architecture.md` §2). `.docs/17-legal/legal-ethical-rules.md` rule 5 is a compile error, not a code review.

---

### 10 · How does the app avoid making accusations?

Five layers, in increasing order of strength:

1. **Language** — server-generated, template-based, neutrality-checked; the client cannot author it (`ServerText` branded type).
2. **Structure** — no anomaly feed, no notification of an observation's text, no ranking, no leaderboard, no score on a contractor. `.docs/01-product/screen-inventory.md` §Screens that must not exist.
3. **Visual** — no red anywhere in variance, severity, priority, or status; no gauges; no warning iconography; colour-blind-safe ramps that are simultaneously an accessibility and a neutrality decision.
4. **Framing** — the neutrality panel in onboarding is non-skippable; disclaimers on every observation surface are non-collapsible; every band label leads with the *action* ("worth a closer look"), not a grade.
5. **CI** — `packages/neutrality` lints every locale on every PR; `tsd` proves a literal cannot be passed as an observation; a palette test proves no red token appears in any band.

The most important single decision: **there is no global anomaly feed and no push notification about observations.** The standard mobile engagement pattern is, here, the fastest route to teaching users that variance means scandal.

---

### 11 · How does navigation stay understandable at depth?

Four tabs; entity routes push onto the active tab's stack; a persistent **scope chip** (where I'm working) plus a contextual **ancestor row** (where this entity sits) plus **long-press-back** (how do I get out). No breadcrumb bar — 44 pt of permanent chrome for what the back stack already encodes. A 12-entry stack guard bounds depth. Deep links build a **synthetic back stack up the hierarchy** (`.docs/10-mobile/navigation-architecture.md`).

---

### 12 · How does it perform on a low-end Android device?

Budgets are stated against a **4 GB, Snapdragon-6-class, Android 11 phone** — not a flagship (`.docs/02-architecture/performance.md`). Cold start ≤2.5 s, tab switch ≤100 ms, 60 fps lists, ≤400 map features, ≤3.5 MB initial bundle, ≤60 KB screen payloads, <450 MB peak memory.

Held by: no network call blocks first paint · synchronous MMKV rehydration · lazy route segments for map/documents/charts/Ask · FlashList everywhere · symbol layers not React markers · composite endpoints instead of 7 round trips · memoized money formatting · New Architecture + Hermes.

**Benchmarks run on a real reference device in CI; a regression is a release blocker.**

---

### 13 · How is it tested?

`.docs/14-testing/testing-strategy.md`. Weighted toward the three failure classes that are not ordinary bugs: a wrong number, a missing source, accusatory language.

`domain/` ≥95% branch coverage (money, variance, fiscal year, formatting — in plain Node) · component tests by accessibility role/label · **contract tests as the executable API specification** (the backend does not exist yet) · `tsd` type tests proving the neutrality primitives cannot be bypassed · 12 Maestro E2E flows including offline, TalkBack, and 200% text scale · **guardrail suite G1–G8 as merge gates**.

---

### 14 · How are production failures observed?

Self-hosted analytics, PII-scrubbed Sentry, `X-Request-Id` on every request echoed into the error UI's "copy diagnostics" — so a user report maps to a server log **with no user identity**.

**No content, ever** — no queries, no questions, no entity ids, no coordinates (`.docs/13-observability/observability.md`). The trade is explicit: weaker product analytics in exchange for a guarantee that no record exists of who looked at what.

Two **integrity alarms**, targeting zero and alerting immediately rather than appearing on a dashboard: `contract_violation{missing_provenance}` and `ai_answer_shown{citation_count: 0}`.

---

### 15 · How does this scale when Maharashtra becomes India?

`.docs/15-scalability/scalability-plan.md` grows the platform from ~10³ admin units to ~10⁶ and from ~10⁶ fact rows to ~10¹⁰. What absorbs it:

| Pressure | Absorbed by |
|---|---|
| New levels | `admin_unit.level` is data; the UI orders levels from a config array |
| New domains | The Unit screen is level- **and domain-agnostic**; a domain registers an asset-section renderer and a cost-per-unit descriptor. **No new screens** |
| New asset types | One `AssetSection` interface + a registry |
| Map scale | Server-side tiles and clusters; a zoom ladder that caps national feature counts by construction |
| Data volume | Server-side aggregation only; the client never computes an aggregate; every list is cursor-paged |
| Bundle growth | Lazy route segments |
| More languages | ICU catalogues; the neutrality lint runs on every locale |
| More contributors | Enforced layer boundaries + feature isolation |

**What would break it:** per-level or per-domain screens — a `DistrictScreen`, a `VillageScreen`, a `HealthProjectScreen`. `.docs/01-product/dashboard-design-legacy.md` already found the general pattern ("money in / money out / what was built / consistency"); making it the *only* implementation is what keeps a 15-level, 12-domain national platform inside one app. That is the single most important architectural decision in this suite.
