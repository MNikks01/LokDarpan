# 23 — Repository Structure

`docs/17` defines the platform monorepo (`apps/`, `services/`, `packages/`, `workers/`, `infrastructure/`). The mobile app **joins that monorepo** as `apps/mobile`; it is not a separate repository.

**Why in the monorepo:** the neutrality word list, the API contract, the domain types (`docs/05`), and the money formatting rules must be **shared, not duplicated**. A copy of the forbidden-language list that drifts from the server's copy is a `docs/15` failure waiting to happen. Shared packages make drift a build error.

---

## Top level

```text
bharat-platform/
├── apps/
│   ├── mobile/              ★ THE PRODUCT — React Native / Expo (iOS + Android)
│   ├── api/                 Node REST gateway + mobile BFF (docs/02, .docs/18)
│   └── admin/               internal console — SSO+MFA, web, out of mobile scope
├── services/                ingestion · analytics · ai · audit · gis   (docs/02, 03, 06, 07, 11, 20)
├── workers/                 crawler · ocr · parser · anomaly
├── packages/
│   ├── shared-types/        domain types (docs/05) — TS, consumed by api + mobile
│   ├── api-contract/        ★ OpenAPI + generated Zod schemas — the single source of truth
│   ├── neutrality/          ★ forbidden-language lists (en/mr/hi) + the linter
│   ├── money/               ₹ formatting rules, Indian grouping, crore/lakh
│   ├── ui-web/              web components (admin console only)
│   └── sdk/                 typed public API client for third parties
├── sources/                 declarative source registry (YAML) — docs/18
├── config/                  road-model · risk-weights · thresholds (versioned)
├── db/                      migrations · seeds
├── infrastructure/          docker · kubernetes · terraform · observability
├── docs/                    ORIGINAL platform documentation (00–20)  ← unchanged
├── .docs/                   ★ MOBILE product & architecture docs      ← this suite
└── .github/workflows/
```

★ = added or materially changed by the mobile-only decision.

### `apps/web/` is removed

`docs/17` lists a Next.js public dashboard. The mobile-only decision deletes it. `packages/ui/` (shared React web components) is renamed `packages/ui-web/` and scoped to the admin console. Neither is deleted silently — `docs/17` should be annotated with a pointer to `.docs/00-document-audit.md` §3.

### The three new shared packages

| Package | Contents | Consumed by | Why shared |
|---|---|---|---|
| **`api-contract`** | OpenAPI spec + generated Zod schemas + generated TS types | `apps/api`, `apps/mobile`, `packages/sdk` | The contract is generated once. A server change that breaks the client fails the client's contract tests in the same PR — which is the entire mechanism preventing `00-document-audit` C1–C13 from recurring |
| **`neutrality`** | Forbidden vocabulary in en/mr/hi, causal-construction patterns, and the lint implementation | server text generation, `apps/mobile` i18n, CI on both | `docs/15` §Enforcement requires one gate. Two copies of the word list is one copy too many |
| **`money`** | Indian grouping, crore/lakh thresholds, paise arithmetic rules | `apps/api`, `apps/mobile` | A figure formatted differently by server and client is a traceability discrepancy |

---

## `apps/mobile/`

```text
apps/mobile/
├── app/                     Expo Router — routes ONLY (tree in .docs/03 §Navigation tree)
├── src/
│   ├── features/            home · search · explore · units · projects · finance
│   │                        procurement · consistency · sources · ask · saved
│   │                        settings · shared
│   ├── domain/              money · fiscal · finance · units · projects
│   │                        provenance · consistency · neutrality
│   ├── data/                contracts · dto · mappers · repositories · local · fixtures ⚠
│   ├── platform/            api · storage · secure · maps · documents
│   │                        notifications · location · analytics · net
│   ├── state/               scopeStore · mapStore · settingsStore · offlineStore
│   ├── ui/                  tokens · primitives · charts · feedback
│   ├── i18n/                en.json · mr.json · hi.json
│   └── config/              env schema (Zod) · flags · constants
├── assets/
│   ├── fonts/               Inter · Noto Sans Devanagari · JetBrains Mono (subset)
│   ├── map-styles/          light.json · dark.json (bundled, never fetched)
│   └── seed/                states + districts — makes S-05 work offline on first run
├── e2e/                     Maestro flows (12, per .docs/17)
├── __tests__/               unit · component · integration · contract · a11y
├── scripts/                 neutrality-lint · i18n-check · licenses · bundle-report
│                            · fixture-drift · contrast-check
├── app.config.ts            Expo config (scheme, associated domains, plugins)
├── eas.json                 build profiles: development · preview · production
├── .dependency-cruiser.js   ★ layer boundaries — enforced in CI
├── tsconfig.json            strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
└── package.json
```

Layer responsibilities and the enforced dependency rules: `.docs/05-mobile-architecture.md`.

### Directories that carry a warning

| Path | Rule |
|---|---|
| `src/data/fixtures/` | ⚠ **MOCK DATA.** Imported only by tests and the `EXPO_PUBLIC_DATA_SOURCE=fixture` dev build. A CI test asserts absence from the production bundle. Every fixture money value carries `sourceName: "FIXTURE — not a government source"` (brief §37) |
| `assets/seed/` | Real government data (state/district names + LGD codes), bundled so scope selection works on first run with no network. Versioned; regenerated from `db/seeds/` |
| `src/i18n/` | Scanned by the neutrality lint in **all** locales on every PR |

---

## Environments and configuration

```text
development   local API or fixtures · dev client · verbose logging · analytics OFF
preview       staging API · internal distribution (TestFlight / Play internal) · analytics ON (staging sink)
production    production API · store builds · OTA channel `production`
```

Config is a **Zod-validated schema** in `src/config/env.ts`; a missing or malformed variable fails at build, not at runtime on a user's phone. No secrets in the app (`.docs/13-mobile-security.md` §2) — `EXPO_PUBLIC_*` values are public by definition and are treated as such.

---

## Where each `.docs` document lives in the build

| Concern | Doc | Enforced by |
|---|---|---|
| Screens & states | `01`, `15` | Component tests, state union type |
| Navigation & links | `03`, `21` | Route tree = link table; link fuzz tests |
| Data flow & contracts | `04`, `18` | `packages/api-contract` + contract tests |
| Architecture boundaries | `05` | `dependency-cruiser` + ESLint `no-restricted-paths` |
| Design system | `06` | Token lint (no raw hex/px), contrast check |
| Neutrality | `docs/15` + `06`, `09`, `10` | `packages/neutrality` lint + `ServerText` branded type + `<Figure>` required provenance |
| Accessibility | `12` | ESLint a11y, role/label tests, 200% snapshots, chart-text-equivalent test |
| Security | `13` | Secret scan, allow-list test, `npm audit`, SBOM |
| Performance | `14` | Bundle delta, startup benchmark, payload assertions |
| Privacy | `16` | Event-union test, forbidden-pattern scan, no-3p-SDK test |

Every document in this suite has at least one automated check. A specification with no enforcement mechanism becomes fiction within two quarters; this table is the antidote.

---

## Documentation convention

- `docs/` — the **platform** documentation (00–20). Data model, pipeline, analytics, legal rules. Not modified by the mobile work, except for two annotations pointing at supersessions (`00-document-audit` C12: `docs/16` Month 3; `docs/17`: `apps/web` removed).
- `.docs/` — the **mobile product and architecture** documentation. The single source of truth for the client.
- `.docs/adr/` — architecture decision records. **New decisions append; existing records are never rewritten.** A superseded ADR gets a `Status: Superseded by ADR-0NN` header and stays.
- Code comments explain *why*; `.docs/` explains *what and how*. A decision that lives only in a comment is a decision that will be silently reversed.

**Rule:** a PR that changes an architectural decision must update the relevant `.docs/` file or add an ADR, in the same PR. Enforced by a PR template checklist and reviewer discipline.
