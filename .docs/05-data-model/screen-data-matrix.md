# 20 — Screen → Data Entity Matrix

Which domain entities (`.docs/05-data-model/database-design.md`, `.docs/05-data-model/data-models.md`, `.docs/03-domain/administrative-hierarchy.md`) each screen touches.

**Legend** — ● primary subject · ○ referenced/summarised · · not used
**Prov.** = provenance rendered on this screen (a `<Figure>` with a source affordance). **Every ●/○ financial cell implies provenance** — that is the invariant, not a per-screen choice.

| # | Screen | AdminUnit | Project | Finance¹ | Tender | Contractor | Scheme | Dept | Asset² | Observation | Priority³ | Coverage | Provenance |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| S-05 | Choose area | ● | · | · | · | · | · | · | · | · | · | ○ | · |
| S-10 | Home | ● | ○ | ○ | · | · | · | · | ○ | ○ | ○ | ○ | ● |
| S-11 | Updates | ○ | ○ | ○ | · | · | · | · | · | ○ | · | · | ● |
| S-13 | Search idle | ○ | ○ | · | ○ | ○ | ○ | ○ | · | · | · | · | · |
| S-14 | Search results | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | · | ○ | · | · |
| S-18 | Explore | ● | ● | ○ | · | · | · | · | ● | ○ | ○ | ○ | ○ |
| S-19 | Feature preview | ○ | ● | ○ | · | · | · | · | ○ | · | ○ | · | ○ |
| S-20 | Cluster | ○ | ● | ○ | · | · | · | · | ○ | · | ○ | · | ○ |
| S-22 | Hierarchy | ● | · | ○ | · | · | · | · | · | · | · | ○ | ○ |
| **S-23** | **Unit detail** | ● | ○ | ● | · | · | ○ | ○ | ○ | ● | ○ | ● | ● |
| S-24 | Unit children | ● | · | ○ | · | · | · | · | · | · | · | ○ | ○ |
| S-25 | Roll-up | ● | · | ● | · | · | ○ | · | · | ● | · | ● | ● |
| S-26 | Peers | ● | · | ● | · | · | · | · | · | ○ | · | ○ | ● |
| **S-27** | **Project detail** | ○ | ● | ● | ○ | ○ | ○ | ○ | ● | ● | ● | ● | ● |
| S-28 | Money Trail | ○ | ● | ● | · | · | ○ | · | · | ○ | · | ● | ● |
| S-29 | Ledger lines | ○ | ○ | ● | ○ | · | ○ | · | · | · | · | ○ | ● |
| S-30 | Ledger line | · | ○ | ● | ○ | · | ○ | · | · | · | · | · | ● |
| S-30a | Value history | · | ○ | ● | · | · | · | · | · | · | · | · | ● |
| S-31 | Timeline | · | ● | ● | ○ | ○ | · | · | ○ | ○ | · | ○ | ● |
| S-32 | Progress | · | ● | ○ | · | · | · | · | ○ | ○ | · | ● | ● |
| S-33 | Road intelligence | ○ | ● | ● | · | · | · | · | ● | ○ | ○ | ● | ● |
| S-34 | Observations (proj) | ○ | ● | ○ | · | · | · | · | · | ● | ○ | ○ | ● |
| S-35 | Observation detail | ○ | ● | ● | ○ | ○ | · | · | ○ | ● | ○ | ○ | ● |
| S-36 | Verification priority | ○ | ● | ● | ○ | ○ | · | · | ○ | ● | ● | ● | ● |
| S-37 | Compare picker | ○ | ● | ○ | · | · | ○ | · | ○ | · | ○ | · | · |
| S-38 | Compare result | ○ | ● | ● | · | · | ○ | · | ● | ○ | ○ | ● | ● |
| S-39 | Project location | ● | ● | ○ | · | · | · | · | ● | · | · | ○ | ○ |
| S-40 | Tender detail | ○ | ○ | ○ | ● | ● | ○ | ○ | · | ○ | · | ○ | ● |
| S-41 | Tenders list | ○ | ○ | ○ | ● | ○ | · | ○ | · | · | · | · | ● |
| S-42 | Contractor detail | ○ | ○ | ○ | ● | ● | · | ○ | · | · | · | ○ | ● |
| S-43 | Contractor tenders | ○ | ○ | ○ | ● | ● | · | ○ | · | · | · | · | ● |
| S-44 | Concentration | ● | · | ○ | ● | ○ | · | ○ | · | ● | · | ○ | ● |
| S-45 | Scheme detail | ○ | ○ | ● | · | · | ● | ○ | · | ○ | · | ● | ● |
| S-46 | Schemes list | ○ | · | ○ | · | · | ● | ○ | · | · | · | · | ○ |
| S-47 | Department detail | ○ | ○ | ● | · | · | ○ | ● | ○ | ○ | · | ● | ● |
| S-48 | Departments list | ○ | · | ○ | · | · | · | ● | · | · | · | · | ○ |
| S-49 | Observations (scoped) | ● | ○ | ○ | · | · | ○ | ○ | · | ● | ○ | ○ | ● |
| S-51 | Coverage report | ● | ○ | ○ | · | · | ○ | ○ | · | · | · | ● | ● |
| **S-52** | **Source sheet** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | · | ● |
| S-53 | Source document | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | · | ○ | ● |
| S-54 | Document viewer | · | · | ○ | · | · | · | · | · | · | · | · | ● |
| S-55 | Lineage | · | ○ | ● | · | · | · | · | · | ○ | ○ | · | ● |
| S-56 | Source registry | ○ | · | · | · | · | · | ○ | · | · | · | ● | ● |
| S-58 | Ask | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | · | ○ | ● |
| S-59 | Ask citations | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | · | · | · | ● |
| S-62 | Saved | ○ | ○ | ○ | ○ | ○ | ○ | ○ | · | ○ | ○ | ○ | ○ |
| S-64 | Offline packs | ● | ○ | ○ | · | · | · | · | ○ | · | · | ○ | · |
| S-77 | Coverage & limits | ○ | · | · | · | · | ○ | ○ | · | · | · | ● | · |
| S-78 | Report data issue | ○ | ○ | ○ | ○ | ○ | · | · | ○ | ○ | · | ○ | ● |

¹ `Finance` = Allocation · Release · Expenditure · Transfer · ProjectFinance (both variances, deviation %, status).
² `Asset` = Road · Bridge · Facility · UtilityAsset · TransportAsset (`.docs/05-data-model/database-design.md`).
³ `Priority` = RiskScore rendered as **Verification Priority** with its factor breakdown and confidence (`.docs/08-risk/risk-scoring-engine.md`).

---

## Entity → screen index

| Entity | Primary screens | Referenced on |
|---|---|---|
| **AdminUnit** | S-05, S-18, S-22, S-23, S-24, S-25, S-26, S-44, S-51, S-64 | most |
| **Project** | S-19, S-20, S-27–S-39 | S-10, S-14, S-18, S-23, S-49, S-62 |
| **Finance** | S-23, S-25, S-26, S-28, S-29, S-30, S-30a, S-33, S-45, S-47, S-55 | most entity screens |
| **Tender** | S-40, S-41, S-43, S-44 | S-27, S-31, S-35, S-42 |
| **Contractor** | S-42, S-43 | S-27, S-40, S-44 |
| **Scheme** | S-45, S-46 | S-23, S-27, S-29, S-49 |
| **Department** | S-47, S-48 | S-23, S-27, S-40, S-56 |
| **Asset** | S-18, S-33, S-38, S-39 | S-27, S-31, S-32 |
| **Observation** | S-25, S-34, S-35, S-44, S-49 | S-10, S-23, S-27, S-36 |
| **VerificationPriority** | S-36 | S-14, S-18–20, S-23, S-27, S-38 |
| **Coverage** | S-51, S-56, S-77 | S-10, S-23, S-27, S-28, S-33, S-45, S-47 |
| **Provenance** | **S-52**, S-53, S-54, S-55, S-56 | **every screen that renders a figure** |

---

## Structural invariants

1. **Provenance appears on 37 of 50 data-bearing screens** — every one that renders a figure. There is no screen on which a monetary or derived value appears without a source affordance (`.docs/02-architecture/mobile-architecture.md` §2 makes this a compile-time property).
2. **AdminUnit is the spine.** It appears on nearly every screen because `.docs/03-domain/administrative-hierarchy.md`'s hierarchy is what makes one Unit screen serve every level. If a future screen cannot be expressed in terms of `admin_unit`, that is a signal it is a desktop pattern in disguise.
3. **Contractor is never co-rendered with VerificationPriority.** Deliberate and load-bearing: `.docs/08-risk/risk-scoring-engine.md` forbids ranking people. Placing a risk score on a contractor screen — even accidentally, by reusing a card component — would breach `.docs/17-legal/legal-ethical-rules.md`. This matrix is the artefact that makes the omission visible and auditable.
4. **Coverage is a first-class entity**, not a UI state. It appears on 10 screens because "what is missing, and which source would carry it" is part of the product's factual content, not an error condition (`.docs/17-legal/legal-ethical-rules.md` rule 8).
5. **Finance never appears without Coverage** on any screen where a chain could be incomplete (S-23, S-27, S-28, S-33, S-45, S-47) — so an incomplete chain can never be read as a complete one.
