# 23 — Repository Structure

**Status:** Active — describes the repository as built. **Rewritten 16 October 2026.** The first
version (24 August 2026) described a mobile-only monorepo that was never created (`bharat-platform/`
with `apps/mobile` as the product, `apps/web` removed, `workers/`, `sources/`, `db/`, and a `docs/`
beside `.docs/`). Its `apps/mobile` layout is kept below as the deferred mobile specification; the
rest is in git history.

**Why one monorepo:** the neutrality word list, the API contract, the domain types and the money
rules must be **shared, not duplicated**. A copy of the forbidden-language list that drifts from the
server's copy is a [`17-legal/legal-ethical-rules.md`](../17-legal/legal-ethical-rules.md) failure
waiting to happen; shared packages make drift a build error.

---

## Top level

```text
lokdarpan/
├── apps/
│   ├── web/                 Next.js App Router — the site and /api/v1 (deployed on Vercel)
│   └── mobile/              deferred; a placeholder until after web launch
├── services/
│   ├── ingestion/           TypeScript collectors, loaders, review CLIs, promote:cag
│   ├── ocr/                 Python (FastAPI, Tesseract) — reads pages with no text layer
│   ├── api/                 the self-hosted API shape; not deployed (audit B13)
│   └── ai · analytics · entity-resolution · normalization · risk-engine   empty skeletons
├── packages/                see the table below
├── database/
│   ├── migrations/          0001–0048, plain SQL, the schema of record (ADR-017)
│   └── scripts/             the local database users (api, etl, intake, reviewer)
├── data/reference/          reviewed reference data (district aliases, CAG fact corrections)
├── .docs/                   this documentation — the one documentation root
├── .changeset/              pending changesets; CHANGELOG.md files are generated from them (ADR-028)
├── .github/                 CI, the nightly collection, the collection check, the PR template
└── docker-compose.yml       Postgres+PostGIS on 5433 and Redis on 6380 for local work
```

Present but holding only `.gitkeep`: `infrastructure/*` (docker, kubernetes, terraform, nginx,
monitoring, environments), `scripts/*`, the top-level `tests/*`, `data/{raw,staging,normalized,fixtures,samples}`
and `database/{seeds,functions,views}`. Tests live beside the code they test, in each package's
`tests/` or as `*.test.ts`. Hosting is Vercel, Neon and GitHub Actions; nothing runs on Kubernetes.
Redis is in `docker-compose.yml` and no code path uses it.

## Packages

| Package         | Holds                                                                                                      | State                    |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| `money`         | `Money` over `bigint` paise; decimal-string conversion; Indian grouping                                    | Real                     |
| `neutrality`    | The forbidden vocabulary (en/mr/hi), `ServerText`, the `pnpm neutrality` CLI                               | Real                     |
| `contracts`     | Zod schemas for everything crossing the network; amounts as decimal strings; three confidences; provenance | Real                     |
| `domain`        | Domain rules shared by web and services, including the publication decision (ADR-073)                      | Real                     |
| `database`      | Repositories over the ledger and the migration runner (`pnpm --filter @lokdarpan/database migrate`)        | Real                     |
| `observability` | Metrics with route patterns and buckets, and log scrubbing (ADR-018, ADR-019)                              | Real                     |
| `errors`        | Shared error types                                                                                         | Real                     |
| `architecture`  | `pnpm architecture`: import-direction rules and rule B, no sentences in components (ADR-059)               | Real                     |
| `config`        | —                                                                                                          | Placeholder (`.gitkeep`) |
| `utils`         | —                                                                                                          | Placeholder (`.gitkeep`) |
| `validation`    | — (merged into `contracts`; see `packages/contracts/README.md`)                                            | Placeholder (`.gitkeep`) |

The web-architecture plan named `api-contract`, `ui` and `sdk` packages. As built, the contract is
`contracts`, the design tokens and shared components live in `apps/web/src/ui` and
`apps/web/src/components`, and there is no SDK.

## Inside `apps/web/src`

| Directory     | Holds                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`        | Routes: `/`, `/explore`, `/units`, `/units/[id]`, `/units/[id]/departments/[code]`, `/bodies/[id]`, `/documents`, `/documents/[id]`, `/tenders/[id]`, `/report`, `/about`, `/about/methodology`, `/project/[id]` (fixture), and `/api/v1/*` |
| `copy/`       | Every reader-facing sentence (rule B of ADR-059; reviewed by the neutrality gate)                                                                                                                                                           |
| `server/`     | Server-only code: `respond()`, rate limiting, the publication switches, the home summary                                                                                                                                                    |
| `components/` | Rendering, including `<Figure>`, which will not compile without `provenance`                                                                                                                                                                |
| `ui/`         | Design tokens; `tokens.test.ts` is CI guardrail G3 (no red in any data token)                                                                                                                                                               |
| `map/`        | The MapLibre explorer: layers, labels, the level cache (ADR-057, 058, 064)                                                                                                                                                                  |

---

## Where each document is enforced

Every document in `.docs/` is meant to have at least one automated check once code exists. This is
the map of the checks that do exist, and of the documents still waiting for one.

| Concern                                       | Document                                                  | Enforced by                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Forbidden language, every locale              | `17-legal/legal-ethical-rules.md`                         | `pnpm neutrality` (`packages/neutrality`) — CI guardrail G1                                                  |
| Import directions; no sentences in components | ADR-059                                                   | `pnpm architecture` (`packages/architecture`) — CI guardrail G2                                              |
| No red in data colours                        | `01-product/design-system.md`                             | `apps/web/src/ui/tokens.test.ts` — CI guardrail G3                                                           |
| Fixture data kept out of production           | `14-testing/testing-strategy.md` §6 G6                    | CI guardrail G6, a search of the production build                                                            |
| Explorer JavaScript budget                    | ADR-062                                                   | `pnpm --filter @lokdarpan/web perf:bytes` — CI guardrail G7                                                  |
| A figure needs its provenance                 | `web-architecture.md` §Neutrality primitives              | The type of `<Figure>`; `pnpm typecheck` in CI                                                               |
| Money as `bigint` paise, decimal strings      | `00-overview/document-audit.md` C3                        | `packages/money` tests; `AmountSchema` in `packages/contracts`                                               |
| Restricted sources stay withheld              | ADR-073; `06-government-sources/permission-requests.json` | `packages/domain/tests/publication-decision.test.ts`, `services/ingestion/tests/permission-registry.test.ts` |
| Secrets stay on the server                    | `16-operations/deployment-vercel.md`                      | `apps/web/src/lib/secrets-stay-on-server.test.ts`                                                            |
| No identifiers in telemetry                   | `13-observability/observability.md`, ADR-018              | `packages/observability/tests/scrub.test.ts`                                                                 |
| Migrations apply cleanly                      | ADR-017                                                   | CI applies every migration to PostGIS before the tests run                                                   |
| The OCR boundary                              | ADR-038                                                   | `services/ocr` tests and `services/ingestion/tests/ocr-contract.test.ts`, over the same examples             |
| Dependencies and committed secrets            | `12-security/security.md`                                 | CI job "Dependencies · Secrets"                                                                              |
| Commit messages and their scopes              | `CONTRIBUTING.md`                                         | `commitlint.config.js` on `commit-msg`                                                                       |
| Formatting, documentation included            | —                                                         | `pnpm format:check` in CI                                                                                    |

**No automated check yet:** the analytics, risk and AI specifications (nothing implements them),
accessibility beyond what the type system and tests cover, and the performance budgets other than
G7. A specification with no enforcement mechanism becomes fiction; these are the places to watch.

---

## Deferred — the `apps/mobile` layout

Written 24 August 2026 for the native app, which follows web launch
([`decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). Kept as specified; revalidate
the toolchain when mobile resumes.

### `apps/mobile/`

```text
apps/mobile/
├── app/                     Expo Router — routes ONLY (tree in .docs/02-architecture/mobile-navigation-architecture.md §Navigation tree)
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
├── e2e/                     Maestro flows (12, per .docs/14-testing/testing-strategy.md)
├── __tests__/               unit · component · integration · contract · a11y
├── scripts/                 neutrality-lint · i18n-check · licenses · bundle-report
│                            · fixture-drift · contrast-check
├── app.config.ts            Expo config (scheme, associated domains, plugins)
├── eas.json                 build profiles: development · preview · production
├── .dependency-cruiser.js   ★ layer boundaries — enforced in CI
├── tsconfig.json            strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
└── package.json
```

Layer responsibilities and the enforced dependency rules: `.docs/02-architecture/mobile-architecture.md`.

#### Directories that carry a warning

| Path                 | Rule                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/fixtures/` | ⚠ **MOCK DATA.** Imported only by tests and the `EXPO_PUBLIC_DATA_SOURCE=fixture` dev build. A CI test asserts absence from the production bundle. Every fixture money value carries `sourceName: "FIXTURE — not a government source"` (brief §37) |
| `assets/seed/`       | Real government data (state/district names + LGD codes), bundled so scope selection works on first run with no network. Versioned; regenerated from `db/seeds/`                                                                                    |
| `src/i18n/`          | Scanned by the neutrality lint in **all** locales on every PR                                                                                                                                                                                      |

---

### Environments and configuration

```text
development   local API or fixtures · dev client · verbose logging · analytics OFF
preview       staging API · internal distribution (TestFlight / Play internal) · analytics ON (staging sink)
production    production API · store builds · OTA channel `production`
```

Config is a **Zod-validated schema** in `src/config/env.ts`; a missing or malformed variable fails at build, not at runtime on a user's phone. No secrets in the app (`.docs/12-security/mobile-security.md` §2) — `EXPO_PUBLIC_*` values are public by definition and are treated as such.

---

---

## Documentation convention

- `.docs/` is the one documentation root. The old split between `docs/` (the platform suite) and
  `.docs/` (the mobile suite) is gone; numbered prefixes in old titles ("04 —", "15 —") are the
  original document numbers, kept so older cross-references still make sense.
- `.docs/adr/` holds architecture decision records. **New decisions append; existing records are never
  rewritten.** A superseded ADR gets a status header naming its replacement and stays.
- Code comments explain _why_; `.docs/` explains _what and how_. A decision that lives only in a
  comment is a decision that will be silently reversed.
- What is built, deployed and open is kept in one place:
  [`00-overview/current-state.md`](../00-overview/current-state.md).

**Rule:** a PR that changes an architectural decision updates the relevant `.docs/` file or adds an
ADR, in the same PR. The PR template asks for it.
