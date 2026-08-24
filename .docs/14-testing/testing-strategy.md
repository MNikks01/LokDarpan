# 17 — Testing Strategy

## What must not break

Ordinary app bugs are recoverable. Three classes of failure here are not:

1. **A wrong number.** A misformatted crore, a float rounding error, a variance computed across a missing stage. The app publishes government figures; a wrong one is a false public statement.
2. **A missing source.** A figure rendered without provenance breaks `.docs/17-legal/legal-ethical-rules.md` rule 5 — the platform's central promise.
3. **Accusatory language.** A copy string, a locale file, or an AI answer that implies wrongdoing. `.docs/17-legal/legal-ethical-rules.md` makes this a release blocker, not a bug.

The test pyramid is weighted accordingly: the correctness-critical domain layer is tested exhaustively and in plain Node; the guardrail suite is a hard gate.

```text
          ╱╲        E2E (Maestro) — 12 flows, critical journeys + offline + a11y
        ╱────╲      Contract tests — Zod schemas vs. recorded fixtures + OpenAPI
      ╱────────╲    Integration — feature workflows with MSW
    ╱────────────╲  Component (RNTL) — every shared + neutrality primitive
  ╱────────────────╲ Unit — domain: money, fiscal, variance, formatting, selectors
 ══════════════════   Guardrails — neutrality lint, provenance, a11y, bundle, perf
```

---

## 1 · Unit — the domain layer

`domain/` has no React and no I/O (`.docs/02-architecture/mobile-architecture.md`), so it runs in plain Node, fast, with property-based tests where the input space is large.

**`Money` (highest-value tests in the codebase)**
- Parse decimal strings → `bigint` paise, including `"0.00"`, `"0.01"`, `"99999999999999.99"`, negative, `null`, `""`, `"1e10"`, and malformed input.
- **Precision:** a national-scale aggregate (~₹50 lakh crore) round-trips exactly — the regression test for `00-document-audit` C3.
- Indian grouping: `800000000` → `₹8,00,00,000` and `₹8.00 crore`; boundaries at 1 lakh, 1 crore, 100 crore, 1 lakh crore.
- Property: `format(parse(x))` is stable; `a.plus(b).minus(b).equals(a)` for arbitrary values.
- Locale variants (en/mr/hi) keep Latin digits (`.docs/01-product/accessibility.md`).
- `toAccessibleString` produces "eight crore rupees", not a digit string.

**`FiscalYear`** parse/format `FY2024-25`, ordering, boundary dates, malformed input, cross-year comparison.

**Finance presentation** given `(A, R, U)` including nulls: correct status (`consistent` / `needs_verification` / `insufficient_data`), correct **labels** for both variances (`00-document-audit` C1), and — critically — **no variance is produced across a null stage**, and a null never renders as zero. Table-driven against every case in `.docs/07-analytics/analytics-engine.md` §1–2, including `U > R` and `R > A`.

**Provenance/confidence** band mapping, the separation of extraction vs. linkage confidence, and the invariant that a fact without provenance cannot be constructed.

**Selectors** every `features/*/selectors/*.ts` is a pure function and is tested directly — this is where view-model logic lives, so it is where the tests go, not in component tests.

Coverage gate: **`domain/` ≥ 95% branches** (enforced). Everything else: meaningful tests, no global coverage number (a coverage target on UI code buys snapshot noise, not confidence).

---

## 2 · Component (React Native Testing Library)

Queried by **accessibility role and label**, never by test ID where a role exists — the tests then read the UI the way a screen reader does, and a11y regressions surface as test failures.

**The neutrality primitives get the most attention:**

| Component | Tests |
|---|---|
| `<Figure>` | Renders value + source affordance · **fails to compile without `provenance`** (type test via `tsd`) · null → `MissingData` with reason, **never ₹0** · low extraction confidence renders the words, not just a chip · low linkage confidence renders distinct wording · a11y label includes value, source, confidence, `asOf` |
| `<Observation>` | **A string literal fails to type-check** (`tsd`) · only `ServerText` accepted |
| `<MissingData>` | Always names the expected source and last-checked date (type-enforced, asserted) |
| `<VerificationPriorityChip>` | Band label leads with the action · **no red token in any band** (asserted against the token file) · one-tap path to the breakdown exists · never renders without confidence |
| `MoneyTrail` | Both variances labelled with formula and denominator · missing stage → `insufficient_data`, no variance across it · every stage tappable · no colour encodes variance magnitude |
| `RecordList` | Virtualized; row memoization; every row has a source affordance |
| `EmptyState` | All five variants distinct; E1 includes the "does not mean no money was spent" sentence |
| `OfflineState` | O2 copy explicitly distinguishes offline from unpublished (**R2** of `.docs/01-product/state-design.md`) |
| Every chart | Exposes a text equivalent **and** a list view — absence fails the test |

**Snapshot policy:** no full-tree snapshots (they rot and get rubber-stamped). Snapshots are used only for layout regression at 100/150/200% text scale, on a small set of representative screens.

---

## 3 · Contract tests — the most valuable tests, given no backend exists

The API is a specification. These tests are what turn drift into a loud failure instead of a crash in production.

- Every Zod schema in `data/contracts/` is validated against **recorded fixtures** derived from `.docs/11-api/api-documentation.md` + `.docs/11-api/client-api-contract.md`.
- **Negative cases:** missing `provenance` → rejected · money as a JS number instead of a decimal string → rejected · unknown enum member → rejected with a typed error, not a crash · null where the contract requires a value → rejected.
- **Payload budgets asserted** (`.docs/02-architecture/performance.md`): a composite fixture exceeding 60 KB gzipped fails the test.
- **Mapper tests:** DTO → domain for every entity, including all null and partial permutations.
- When the backend exists: a nightly job records live responses into fixtures and diffs them against the committed set. **A diff opens a PR** — schema drift becomes a review item rather than a production incident.
- Generated from OpenAPI where available, so the client contract and the server contract cannot silently diverge.

---

## 4 · Integration — feature workflows

MSW (Mock Service Worker) intercepts at the network layer, so repositories, TanStack Query, mappers, and screens are all exercised together with only the socket faked.

Covered: search → results → project · unit drill-down through three levels · save → offline bundle written → airplane mode → still renders with provenance · dataset version bump → stale marking (without eviction) → refresh chip · cursor pagination including `409 CursorStale` recovery · `429` handling with `Retry-After` · contract mismatch → cached data retained, no crash · queued data-issue report flushed on reconnect with idempotency · deep link → synthetic back stack construction.

---

## 5 · E2E (Maestro)

**Maestro over Detox** for this project: YAML flows are readable by non-engineers (a product or legal reviewer can read the neutrality flow), setup is far simpler, and CI flakiness is materially lower. Detox's finer-grained synchronization is not needed for flows that are mostly navigation and reading. `adr/009-testing.md`.

The 12 flows:

1. **Core journey** — launch → search → project → Money Trail → source sheet → document page (`.docs/01-product/prd.md` use case 1, end to end).
2. Near-me — permission → map → feature → project.
3. Hierarchy — district → taluka → GP → coverage state.
4. Compare — pick peers → comparison cards.
5. Save & offline — save → airplane mode → open → **source sheet still complete**.
6. Offline cold start — airplane mode from launch → Home renders from cache with the offline bar.
7. Ask — scoped question → streamed answer → citation → source → document.
8. Deep link — cold and warm, with synthetic back stack verified.
9. Error handling — server 500 → section retry → success.
10. Empty states — a unit with no published records → E1 copy verified verbatim.
11. **Accessibility** — flow 1 driven with TalkBack; figure announcements asserted to include provenance.
12. Text scale — flow 1 at 200%; **assert no money value is truncated**.

Run on merge to main and pre-release, on real reference-class devices in a device farm (emulators only for PR smoke).

---

## 6 · Guardrail suite — the release gates

This is what makes `.docs/17-legal/legal-ethical-rules.md` enforceable rather than aspirational. Each runs on every PR and blocks merge.

**G1 · Neutrality lint** (`scripts/neutrality-lint`)
Scans `i18n/*.json` (**all locales**), JSX string literals, and E2E fixtures for the forbidden vocabulary of `.docs/17-legal/legal-ethical-rules.md` — corrupt, scam, fraud, stolen, theft, embezzle, guilty, illegal, criminal, bribe, kickback, divert, siphon, loot, suspicious, and their Marathi/Hindi equivalents — plus causal constructions ("because the contractor…", "due to misuse"). Any hit fails the build. The same word list the platform's CI uses (`.docs/17-legal/legal-ethical-rules.md` §Enforcement), shared as a package so client and server cannot drift.

**G2 · Provenance enforcement**
A static check that no monetary or derived value is rendered outside `<Figure>`; plus `tsd` type tests proving `<Figure>` without `provenance` and `<Observation>` with a literal both fail compilation.

**G3 · Palette check**
No red token appears in any verification-priority, variance, severity, or status style. No red/green diverging ramp exists. Contrast assertions for both themes.

**G4 · Accessibility**
Every `Pressable` has a label; every chart has a text equivalent; every screen passes the 200% snapshot; ESLint a11y rules clean.

**G5 · Privacy**
Every event in the analytics union is serialized with adversarial values and asserted free of forbidden patterns; the production bundle is asserted to contain no third-party analytics SDK; a network-allow-list test asserts the app contacts only expected hosts.

**G6 · Mock isolation** (brief §37)
A build-time test asserts that `data/fixtures/` is absent from the production bundle, and that every fixture money value carries `sourceName: "FIXTURE — not a government source"`.

**G7 · Performance**
Bundle-size delta ≤5% without justification; startup benchmark within 10% on the reference device; render benchmarks for `MoneyTrail`, `RecordList` (500 rows), map screen.

**G8 · Security**
`npm audit` clean at high severity; secret scan; SBOM generated; no cleartext-traffic exception in either platform config.

---

## 7 · What is *not* tested here

The **AI guardrail evaluation** — red-team prompts, golden-set factuality, neutrality classification — lives server-side and is a gate on the AI service (`.docs/09-ai/ai-layer.md` §Evaluation, `.docs/01-product/roadmap-platform.md` M4). The client's obligation is narrower and is tested here: an answer with zero citations is dropped, a partial stream is discarded, and no AI text is rendered above the source-linked ledger.

---

## 8 · Tooling and CI

`Jest` + `@testing-library/react-native` + `msw` + `tsd` + `maestro` + `eslint` (+ a11y, import boundaries) + `prettier` + `tsc --strict` + `dependency-cruiser`.

TypeScript is `strict` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride`. `any` is banned outside `data/contracts` boundary code, where it is `unknown` narrowed by Zod.

```yaml
PR:            typecheck · lint · boundaries · unit · component · contract
               · integration · G1–G6 · bundle delta        (~6 min)
Merge to main: + E2E on device farm · G7 · G8               (~25 min)
Nightly:       + fixture drift diff · full 3G-throttled E2E · a11y sweep
Pre-release:   + manual a11y walkthrough · manual perf on reference device
               · legal/neutrality copy review (.docs/17-legal/legal-ethical-rules.md)
```

**Definition of done for a feature:** domain logic unit-tested · components tested by role/label · contract test with negative cases · one integration test · states from `.docs/01-product/state-design.md` implemented and tested · a11y verified at 200% · guardrails green · performance budget checked.
