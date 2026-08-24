# 25 — Implementation Roadmap

Supersedes Month 3 of `.docs/01-product/roadmap-platform.md` (which builds a Next.js dashboard — `.docs/00-overview/document-audit.md` C12). Backend months 1, 2, 4, 5, 6 of `.docs/01-product/roadmap-platform.md` stand, with the additions in `.docs/11-api/client-api-contract.md`.

**Team assumption:** 2 mobile engineers + 1 designer (part-time) + the existing backend/data team. **Duration:** ~20 weeks to a Phase-1 public launch. Adjust proportionally for a different team.

---

## Dependency on the backend

The mobile app is blocked on five P0 backend items. Until they land, development proceeds against `data/fixtures/` with Zod contract tests as the executable specification — which is a deliberate strategy, not a workaround: the contract tests *are* the API spec, and the day the backend appears they become drift detection.

| P0 (blocking) | Blocks |
|---|---|
| Mobile BFF composites | Every entity screen |
| Search + suggest | The Search tab |
| Money as decimal string · both variances · three confidences | Correctness of every figure |
| Provenance page anchors | Source traceability |
| Mobile rate tier (CGNAT) | The app working on Indian carriers at all |

Full priority table: `.docs/11-api/client-api-contract.md` §7.

---

## Phases

### P1 · Foundation — weeks 1–2
Expo + TS strict + New Architecture + Hermes · Expo Router skeleton with the full route tree · layer boundaries wired into `dependency-cruiser` and ESLint · apiClient (timeout, retry, cancel, ETag, `requestId`, error union) · Zod contract scaffold + fixture repositories · MMKV + SQLite/Drizzle + SecureStore · i18n scaffold (en/mr/hi) · CI: typecheck, lint, boundaries, unit, bundle delta.
**Also in week 1: the MapLibre spike** (`adr/006-maps.md`) — New Architecture compatibility, offline packs, clustering, data-driven styling, on a physical reference device. It must run before any map UI is written, so a failure supersedes the ADR at zero cost.
**Exit:** an app that builds for both platforms, navigates an empty route tree, and fails CI on a boundary violation.

### P2 · Design system + neutrality primitives — weeks 3–4
Tokens (both themes) · typography with tabular figures · the `Money` value object with `bigint` paise · **`<Figure>`, `<Observation>`, `<MissingData>`, `<VerificationPriorityChip>`** · `RecordList` · `EmptyState`/`ErrorState`/`OfflineState`/`LoadingSkeleton` · chart kit on `react-native-svg` · `packages/neutrality` + the lint · `tsd` type tests.
**Exit:** `<Figure value={x} />` without provenance **fails to compile**; `<Observation text="..." />` with a literal fails to compile; the neutrality lint blocks a PR; contrast passes in both themes. `.docs/17-legal/legal-ethical-rules.md` is now structurally enforced — before any screen exists to violate it.

### P3 · Navigation + shell — week 5
Four tabs · shared entity routes · scope + FY stores with persistence · scope chip, ancestor row, long-press-back, 12-entry stack guard · sheet infrastructure with detents and a11y · error boundaries at three levels · deep-link route table + parameter validation + synthetic back stack.
**Exit:** navigate 9 levels deep and get back out in one gesture; a deep link builds a real ancestor stack.

### P4 · Home — week 6
S-10, S-08, S-09 · bootstrap and onboarding (S-01–S-05) with the **non-skippable neutrality panel** · scope selection working offline from the bundled seed list.
**Exit:** cold start to interactive Home ≤2.5 s on the reference device, with no network.

### P5 · Search — weeks 7–8
S-13–S-17 · debounce, cancellation, grouped results, facets · the three zero-result states · offline FTS5 over saved items · **no query text in any telemetry** (asserted by test).
**Exit:** J2 end to end; privacy test green.

### P6 · Unit hierarchy — weeks 9–10
**S-23, the level-agnostic Unit screen** · S-22, S-24, S-25, S-26, S-51.
**Exit:** the same screen renders correctly at state, district, taluka, ULB, Gram Panchayat, and ward — including a GP with almost no data, where coverage leads. J7 and J8 pass.

### P7 · Project + Money Trail + sources — weeks 11–13
**The core of the product.** S-27, S-28, S-29, S-30, S-30a, S-31, S-32, S-33 · **S-52, S-53, S-54, S-55, S-56, S-57** · S-34, S-35, S-36.
**Exit:** J3, J4 and **J10** pass end to end — including a page-anchored document open over a throttled 3G connection, and an `insufficient_data` chain rendering with no `₹0` anywhere.

### P8 · Maps — weeks 14–15
S-18 (map ⇄ list), S-19, S-20, S-21, S-39 · zoom ladder · server-side clusters · 400-feature cap **with the truncation announced** · offline tiles · unmapped-project count.
**Exit:** ≥50 fps pan on the reference device; list mode is a complete equivalent of map mode.

### P9 · Procurement, schemes, comparison — week 16
S-40–S-48, S-37, S-38.
**Exit:** J5 and J6 pass. **A review confirms no score, rank, badge, or flag appears anywhere on a contractor screen** (`.docs/08-risk/risk-scoring-engine.md`).

### P10 · Saved, offline, notifications — weeks 17–18
S-62–S-65, S-11 · offline bundles including provenance · offline packs with delta refresh · on-device watchlist diff + local notifications · queued data-issue reports.
**Exit:** J12 passes; airplane-mode E2E passes; **the watchlist provably never leaves the device** (network-allow-list test).

### P11 · Ask — week 19
S-58–S-61 · streamed answers with named retrieval stages · citation enforcement · refusal state · quota · offline disabled state.
**Exit:** J11 passes; an answer with zero citations is dropped client-side (tested); no question text in telemetry (tested).

### P12 · Hardening and launch — week 20+
Accessibility sweep (200% scale, TalkBack, contrast, chart text equivalents) · performance pass on the reference device · security review (`.docs/12-security/mobile-security.md` §12) · **legal/neutrality copy review against `.docs/17-legal/legal-ethical-rules.md`, in all three locales** · store listings with the non-affiliation statement · staged rollout · monitoring and runbooks.
**Exit:** every item in the quality gate green; external accessibility review with assistive-technology users; external security review.

---

## Sequencing rationale

**Why the design system and neutrality primitives come before any screen (P2, weeks 3–4).** Once ten screens exist, retrofitting "a figure cannot render without provenance" means editing ten screens and hoping none is missed. Built first, it is impossible to violate — the first screen written already cannot break `.docs/17-legal/legal-ethical-rules.md`. This is the single most important sequencing decision in the plan.

**Why the Unit screen (P6) precedes the Project screen (P7).** S-23 is the harder abstraction and the bigger risk: if the level-agnostic pattern does not hold at Gram Panchayat level, that must be discovered in week 10, not week 19. S-27 is comparatively conventional.

**Why sources ship with the project screen, not after.** Traceability is not a feature to add later — it is the product. Building S-27 without S-52 would produce a dashboard, and dashboards are hard to convert back into evidence tools.

**Why maps come eighth.** The heaviest and riskiest surface, but not on the critical path for J3 or J10. Nothing above depends on it, and the week-1 spike has already de-risked the library choice.

**Why Ask is last.** It is advisory and secondary by design (`.docs/09-ai/ai-layer.md`: if AI and ledger disagree, the ledger wins). It also depends on the most backend work.

---

## Risks to the plan

| Risk | Impact | Mitigation |
|---|---|---|
| **Backend P0 items slip** | High — blocks P6/P7 | Fixture-driven development + contract tests; the app is buildable and demoable against fixtures throughout |
| MapLibre spike fails | Medium | Week-1 gate; `MapAdapter` boundary; `@rnmapbox/maps` fallback documented |
| Source documents lack `Range` support | Medium — degrades J10 | Re-host artifacts in the platform object store (already immutable per `.docs/04-data-engineering/data-collection-architecture.md`) |
| Local-body data too sparse to test S-23 at GP level | Medium | Build against real sparse fixtures from day one; a GP with almost nothing is the *design case*, not the edge case |
| Licence unresolved (`adr/001`) | **Blocks submission** | Decide before P4; recommendation: Apache-2.0 or MPL-2.0 for `apps/mobile` |
| Neutrality review finds systemic copy issues late | High | The lint runs from week 3; legal review is scheduled at P12 **and** at P7 for the Money Trail and observation copy specifically |
| Reference-device performance misses budget | Medium | Benchmarks in CI from P1; a regression is a release blocker, not a backlog item |

---

## Definition of done, per phase

Every phase exits only when: screens match `.docs/wireframes/` · all states from `.docs/01-product/state-design.md` implemented · domain logic unit-tested · components tested by accessibility role/label · contract tests with negative cases · a11y verified at 200% scale · performance budget met on the reference device · **guardrails G1–G8 green** · `.docs/` updated if a decision changed.

---

## After launch

`.docs/15-scalability/scalability-plan.md`'s eight-phase expansion. The mobile work per phase should be small if this architecture holds:

| Platform phase | Expected mobile work |
|---|---|
| 2 — MH ministries | Register domain asset sections + cost-per-unit descriptors. **No new screens** |
| 3 — MH districts | Config: enable additional hierarchy levels |
| 4 — MH villages | Coverage-first emphasis at local-body level (already built in P6) |
| 5 — India roads | Per-state tile packs; re-validate map budgets; **map cost/licence review gate** |
| 6–8 — India, all | Re-validate list/search/map budgets on the then-current reference device |

If any of these requires new screens rather than configuration, the level- and domain-agnostic design has failed somewhere, and that is the signal to revisit `.docs/02-architecture/mobile-architecture.md` §Scaling rather than to add screens.
