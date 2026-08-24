# 05 — Mobile Architecture

## Principles applied (and where they are *not* applied)

The brief asks for SOLID, separation of concerns, dependency inversion, and testability — and explicitly warns against Clean Architecture as ceremony. The resolution used throughout:

**Boundaries exist where something crosses them.** There are exactly four:

1. **Network ↔ domain** — because the backend does not exist yet, will drift, and returns data whose shape is a legal contract (`provenance` on every figure). This boundary is a Zod schema plus a mapper, and it earns its keep on day one.
2. **Domain ↔ UI** — because financial formatting, neutrality rules, and traceability invariants must be impossible to bypass from a component.
3. **Feature ↔ feature** — because at national scale this codebase grows to dozens of domains (roads → health → education → water) and features must not reach into each other.
4. **Platform ↔ app** — maps, storage, secure storage, notifications, and the document viewer are all replaceable vendors behind adapters.

**No boundary is introduced anywhere else.** No use-case classes, no interactor layer, no repository interface with exactly one implementation "for testability" (fixture repositories are real second implementations, so those interfaces are earned). No DI container — module composition and hook injection are sufficient at this size.

---

## Layers

```text
┌──────────────────────────────────────────────────────────────┐
│ app/            Expo Router routes. Thin. Compose + wire.     │
├──────────────────────────────────────────────────────────────┤
│ features/<x>/   screens · components · hooks (view models)    │
│                 One feature = one bounded product area.       │
├──────────────────────────────────────────────────────────────┤
│ domain/         Types · value objects (Money, FiscalYear)     │
│                 · pure functions · invariants. NO React,      │
│                 NO I/O, NO React Native imports.              │
├──────────────────────────────────────────────────────────────┤
│ data/           repositories · remote sources · Zod contracts │
│                 · DTO→domain mappers · local sources          │
├──────────────────────────────────────────────────────────────┤
│ platform/       apiClient · storage · secure store · maps     │
│                 · notifications · docs viewer · analytics     │
├──────────────────────────────────────────────────────────────┤
│ ui/             design system: tokens + primitives.           │
│                 Knows nothing about public finance.           │
└──────────────────────────────────────────────────────────────┘
```

### Dependency rule (enforced, not advisory)

```text
app  →  features  →  domain
                 →  data     →  domain
                              →  platform
features →  ui
data     ⇏  React, features, app
domain   ⇏  everything except other domain modules
ui       ⇏  features, data, domain
```

Enforced by `eslint-plugin-import` `no-restricted-paths` + `dependency-cruiser` in CI. A violation fails the build. Specific bans that matter:

- A screen importing `apiClient`, a Zod schema, or a DTO type.
- `domain/` importing `react`, `react-native`, or anything with I/O — this keeps every financial calculation and formatter testable in plain Node, which is where the correctness-critical tests live.
- `ui/` importing a domain type — a `Money` renderer lives in `features/shared`, not in the design system. This keeps `ui/` reusable as the platform expands to health/education.
- Cross-feature imports. Features share only through `domain/`, `ui/`, and `features/shared/`.

---

## Folder structure

```text
apps/mobile/
├── app/                                  # Expo Router — routes only
│   ├── _layout.tsx                       # providers: Query, theme, i18n, error boundary
│   ├── (onboarding)/                     # S-02..S-05
│   ├── (tabs)/
│   │   ├── _layout.tsx                   # 4 tabs
│   │   ├── home/{index,updates}.tsx
│   │   ├── explore/{index,browse/[unitId]}.tsx
│   │   ├── search/{index,results,history}.tsx
│   │   └── saved/{index,collection/[id],packs}.tsx
│   ├── unit/[id]/{index,children,consistency,peers,observations,coverage}.tsx
│   ├── project/[id]/{index,finance,timeline,progress,intelligence,priority,compare,location}.tsx
│   │   ├── ledger/[kind]/{index,line/[lineId]}.tsx
│   │   └── observations/{index,[observationId]}.tsx
│   ├── {tender,contractor,scheme,department}/[id]/...
│   ├── source/[docId]/{index,document,lineage}.tsx
│   ├── ask/{index,citations,history}.tsx
│   ├── settings/*.tsx
│   └── +not-found.tsx
│
├── src/
│   ├── features/
│   │   ├── home/           {screens,components,hooks}
│   │   ├── search/
│   │   ├── explore/                      # map + hierarchy browser
│   │   ├── units/                        # the level-agnostic Unit screen (S-23)
│   │   ├── projects/
│   │   ├── finance/                      # Money Trail, ledger, variance
│   │   ├── procurement/                  # tenders + contractors
│   │   ├── consistency/                  # observations, coverage, verification priority
│   │   ├── sources/                      # source sheet, document viewer, lineage
│   │   ├── ask/
│   │   ├── saved/                        # saved items, collections, offline packs
│   │   ├── settings/
│   │   └── shared/                       # cross-feature product components:
│   │                                     #   Figure, MoneyText, Observation, SourceChip,
│   │                                     #   VerificationPriorityChip, CoverageNote,
│   │                                     #   EntityHeader, AncestorRow
│   ├── domain/
│   │   ├── money/          Money value object (integer paise), Indian formatting
│   │   ├── fiscal/         FiscalYear parse/format/compare
│   │   ├── finance/        variance labels, status mapping, chain model
│   │   ├── units/          AdminUnit, level ordering, ancestor helpers
│   │   ├── projects/       Project, status, category
│   │   ├── provenance/     Provenance, Confidence bands, Traceable<T>
│   │   ├── consistency/    Observation, Severity, VerificationPriority, factors
│   │   └── neutrality/     branded ServerText type + copy guards
│   ├── data/
│   │   ├── contracts/      Zod schemas, one file per endpoint  (the API contract, in code)
│   │   ├── dto/            inferred DTO types (never leave this folder)
│   │   ├── mappers/        DTO → domain (the only place both types are visible)
│   │   ├── repositories/   {project,unit,search,map,source,observation,ask,saved}Repository
│   │   ├── local/          sqlite/{schema,migrations,queries}, mmkv/, fs/
│   │   └── fixtures/       ⚠ MOCK — clearly marked, dev/test builds only
│   ├── platform/
│   │   ├── api/            apiClient, errors, requestId, etag, retry, streaming
│   │   ├── storage/        MMKV wrapper, query persister
│   │   ├── secure/         SecureStore wrapper (tokens only)
│   │   ├── maps/           MapAdapter — the ONLY module importing the map SDK
│   │   ├── documents/      PDF viewer adapter, range fetch, host allow-list
│   │   ├── notifications/  local scheduling + (optional) push token
│   │   ├── location/       permission + coarse position
│   │   ├── analytics/      event sink (privacy filter lives here)
│   │   └── net/            connectivity + effective-type observer
│   ├── state/              zustand: scopeStore, mapStore, settingsStore, offlineStore
│   ├── ui/                 tokens/, primitives/, charts/, feedback/  (see 06-design-system)
│   ├── i18n/               en.json · mr.json · hi.json + ICU plural/number config
│   └── config/             env schema (Zod), feature flags, constants
│
├── e2e/                    Maestro flows
├── __tests__/              unit · component · integration · contract
└── scripts/                neutrality-lint, i18n-check, licenses, bundle-report
```

---

## The three architectural decisions that carry the product

### 1 · `Money` is a value object, never a number

```ts
// domain/money — no floating point anywhere in the app
export class Money {
  private constructor(private readonly paise: bigint) {}
  static fromApi(decimalString: string): Money   // "900000000.00" → 90000000000n
  static zero(): Money
  plus(o: Money): Money
  minus(o: Money): Money                          // the ONLY subtraction the app may do:
                                                  // presentational only; variances arrive computed
  compare(o: Money): -1 | 0 | 1
  isZero(): boolean
  format(locale: Locale, style: 'crore-lakh' | 'full' | 'compact'): string
  toAccessibleString(locale: Locale): string      // "nine crore rupees"
}
```

Why: `.docs/05-data-model/database-design.md` stores `NUMERIC(20,2)`; a national multi-year rollup exceeds `Number.MAX_SAFE_INTEGER` (`00-document-audit` C3) and would fail **silently**, producing a wrong government figure with a correct-looking source link. `bigint` paise removes the class of bug entirely. Formatting is a domain concern because Indian grouping (`##,##,###`), crore/lakh selection, and Marathi numerals are product rules, not view details.

### 2 · A figure cannot be rendered without its provenance

```ts
// features/shared/Figure.tsx
type FigureProps = {
  value: Money | number | null;
  provenance: Provenance;          // required — not optional, no default
  missingReason?: string;          // required (type-level) when value is null
  confidence: ExtractionConfidence;
  asOf: IsoDate;
  label: string;
};
```

There is no code path that renders a monetary or derived figure without a source affordance. `.docs/01-product/dashboard-design-legacy.md` calls this "a UI contract, not optional"; here it is a **type error** to violate it. The domain mapper refuses to construct a fact without provenance and emits a `ContractViolation` event instead (`.docs/02-architecture/data-flow.md` §12).

### 3 · Neutral copy cannot be authored in a component

```ts
// domain/neutrality
declare const brand: unique symbol;
export type ServerText = string & { readonly [brand]: 'server-authored' };
export const asServerText = (s: string, source: 'api'): ServerText => s as ServerText;

// features/shared/Observation.tsx
type ObservationProps = { text: ServerText; /* … */ };   // a string literal will not type-check
```

An observation, a variance explanation, or an anomaly description may only come from the server, where it is generated from vetted templates and passed the neutrality checker (`.docs/17-legal/legal-ethical-rules.md` §Enforcement). A developer cannot write `<Observation text="This contractor overcharged" />` — it fails compilation. Combined with the `scripts/neutrality-lint` CI gate over `i18n/*.json` (all locales), this makes `.docs/17-legal/legal-ethical-rules.md` structurally enforced rather than reviewed.

---

## Repository pattern (and why the interface is earned)

```ts
export interface ProjectRepository {
  getProject(id: ProjectId, fy: FiscalYear, signal?: AbortSignal): Promise<Project>;
  getFinance(id: ProjectId, fy: FiscalYear): Promise<FinanceChain>;
  getLedger(id: ProjectId, kind: LedgerKind, cursor?: Cursor): Promise<Page<LedgerLine>>;
}
```

Three real implementations exist, so the abstraction is not ceremony:

| Implementation | Used by |
|---|---|
| `HttpProjectRepository` | production |
| `FixtureProjectRepository` | UI development before the API exists, Storybook-equivalent screens, deterministic component tests |
| `OfflineFirstProjectRepository` | wraps HTTP + SQLite; the composition used in the app shell |

**Mock discipline** (brief §37, non-negotiable): fixtures live only in `data/fixtures/`, are imported only by `__tests__/` and by a `EXPO_PUBLIC_DATA_SOURCE=fixture` dev build, are stripped from production bundles by a build-time guard test, and every fixture money value is an obviously synthetic round number carrying `sourceName: "FIXTURE — not a government source"`. A fixture figure must never be mistakable for a real government figure in a screenshot.

---

## State ownership

| State | Where | Persisted | Why not elsewhere |
|---|---|---|---|
| Server data | TanStack Query | MMKV | Caching, dedup, background refresh, offline — hand-rolling this is the classic mistake |
| Scope (unit + FY) | Zustand `scopeStore` | ✅ | Global, cross-tab, read by nearly every query key. Query cache is the wrong home for user intent |
| Settings, locale, theme | Zustand `settingsStore` | ✅ | |
| Map camera, layer, metric | Zustand `mapStore` | session only | Restoring a stale camera on cold start disorients |
| Offline pack progress | Zustand `offlineStore` + SQLite | ✅ | |
| Saved items | SQLite (source of truth) + a Query wrapper for reactivity | ✅ | Needs querying and joins; MMKV cannot |
| Filters, sort, tab | Route params | in-stack | Makes a filtered view shareable and restorable |
| Sheet open/closed, input text | Local `useState` | ❌ | Transient |

**No Redux.** There is no complex cross-cutting client state: the server owns the data, TanStack Query owns its cache, and the remaining client state is four small slices. Redux (or Redux Toolkit) would add a store, middleware, action/selector boilerplate, and a mental model, for state that fits in ~150 lines of Zustand. `adr/003-state-management.md`.

---

## Error boundaries and resilience

```text
Root ErrorBoundary                  → "Something went wrong" + copy diagnostics (requestId) + restart
 └─ Route ErrorBoundary (per route) → screen-level fallback, back still works
     └─ Section ErrorBoundary       → a failed section renders an inline retry;
                                       the rest of the screen keeps working
```

A single failing section — say, road intelligence — must never take down a project screen whose Money Trail rendered fine. Every boundary reports to Sentry with the `requestId` and the screen ID, never with figures or query text (`.docs/13-observability/observability.md`).

---

## Feature module anatomy (the shape every feature follows)

```text
features/projects/
├── screens/         ProjectDetailScreen.tsx        # layout + composition only
├── components/      MoneyTrail.tsx  ObservationList.tsx  PriorityChip.tsx
├── hooks/           useProjectDetail.ts            # view model: query + selector + UI state
├── selectors/       projectViewModel.ts            # pure: domain → view model (unit-tested)
└── index.ts         # the ONLY public surface; deep imports are lint-banned
```

A screen file that exceeds ~150 lines or a hook that owns more than one concern is a refactor signal, not a style preference — but the rule is "extract when it has two reasons to change," not "extract on a line count."

---

## Scaling to the national platform

`.docs/15-scalability/scalability-plan.md` takes this from Maharashtra roads to every ministry, state, district, and village. What in this architecture absorbs that:

| Scale pressure | Absorbed by |
|---|---|
| New domains (health, education, water) | The Unit screen is level- and domain-agnostic; a domain adds an **asset section renderer** + a **cost-per-unit metric descriptor**, registered in a table. No new screens |
| New hierarchy levels | `admin_unit.level` is data. The UI orders levels from a config array; a new level is a config entry and a label |
| Asset types (facility, utility, transport) | One `AssetSection` interface, one registry, one renderer per type |
| More screens | Feature-per-folder + enforced boundaries keep build and blast radius local |
| Bundle growth | Map, document viewer, charts, and Ask are lazy route segments — the initial bundle never carries them (`.docs/02-architecture/performance.md`) |
| More languages | ICU message files; the neutrality lint runs on every locale |
| More data per screen | Cursor pagination + `FlashList` + section-level fetching are already the default |

**The thing that would break it** is per-level or per-domain screens — a `DistrictScreen`, a `VillageScreen`, a `HealthProjectScreen`. `.docs/01-product/dashboard-design-legacy.md` already found the general pattern ("money in / money out / what was built / consistency"); this architecture makes that pattern the only implementation, which is what keeps a 15-level, 12-domain national platform inside one app.
