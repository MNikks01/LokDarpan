# 08 — Search Experience

Search is the journalist's and the RTI activist's front door, and `.docs/11-api/api-documentation.md` does not define a search endpoint at all (`00-document-audit` M1). This document specifies the experience and the requirement.

---

## What must be searchable

| Type                                | Matched on                                          | Result subtitle (the disambiguator)               |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| **Place** (`admin_unit`, any level) | name, LGD/census/ULB/PRI code, all transliterations | level + parent chain ("Village · Baramati, Pune") |
| **Project**                         | name, `external_work_id`, scheme code               | category + district + FY                          |
| **Road**                            | name, road number (ODR-14, SH-60), class            | length + district                                 |
| **Contractor**                      | canonical name **and every alias**                  | tender count + primary scope                      |
| **Tender**                          | `external_tender_id`, title                         | status + awarded amount + date                    |
| **Scheme**                          | name, scheme code, common acronym (PMGSY, AMRUT)    | ministry + domain                                 |
| **Department / ministry**           | name, code                                          | tier + state                                      |
| **Source document**                 | title, authority                                    | doc type + published date                         |

Disambiguation is not decoration. India has many villages named Rampur; a result list of eight identical rows is a failed search.

---

## Behaviour

```text
S-13 idle          recent searches · saved items · typed examples
   ↓ typing (≥2 chars, debounced 250 ms, previous request aborted)
suggest            GET /search/suggest?q=&scope=  → ≤8 typed suggestions, inline
   ↓ submit / tap suggestion
S-14 results       grouped by type, fixed order, ≤3 per group + "See all N"
   ↓
entity screen
```

**Grouped, never flat.** A flat relevance list mixes a village, a tender ID, and a contractor into one column where the user cannot tell what they are looking at. Fixed group order (Places · Projects · Contractors · Tenders · Schemes · Departments · Documents) means the eye learns where to look.

**Scope-aware, not scope-locked.** Results within the user's current scope rank higher and are labeled "in Pune district"; results outside it still appear, under a "Elsewhere in Maharashtra" divider. A journalist searching a contractor must not have results hidden by a scope they set for another purpose.

---

## Matching requirements (backend, M1)

These are requirements on the search service, not client behaviour:

1. **Exact-ID first.** A query matching `external_work_id`, `external_tender_id`, an LGD code, or a scheme code returns that record as the top result, always, before any fuzzy match. Investigators paste IDs.
2. **Transliteration both ways.** `बारामती` and `baramati` and `Bāramatī` must reach the same unit. Indian place names have no canonical romanization; matching only one script excludes either the Marathi-reading citizen or the English-typing journalist.
3. **Typo tolerance** — trigram/edit-distance, tuned so that `Ahmadnagar`/`Ahmednagar`/`Ahilyanagar` (a genuine recent rename) all resolve, with renamed units showing "formerly known as".
4. **Alias matching on contractors** — `.docs/04-data-engineering/data-collection-architecture.md` canonicalizes messy contractor names; search must match the _aliases_, and the result must show which alias matched, so the canonicalization stays auditable (`.docs/01-product/user-journeys.md` J6).
5. **Acronyms and abbreviations** — PMGSY, MGNREGA, ZP, GP, NH/SH/MDR/ODR, PWD.
6. **No cross-entity guessing.** If a query matches nothing, the app says so and explains why (S-15); it never returns a low-confidence unrelated entity to avoid an empty screen.

---

## Filters (S-16)

Entity type · place (current scope / choose) · fiscal year · category · status · verification-priority band · with-observations-only · has-source-document. Applied live with a result count on the Apply button. Filters live in **route params**, so a filtered result set is a shareable deep link (`.docs/10-mobile/deep-linking.md`).

---

## The three empty states

Conflating these is the most common search failure, and here it has a data-honesty consequence:

| Case                       | Copy                                                                                                                                    | Actions                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Outside coverage**       | "LokDarpan currently covers Maharashtra roads. _Nashik railway_ may be outside what we've ingested."                                    | ▸ What we cover (S-77)                                  |
| **Probable typo**          | "No results for _baramti_. Did you mean **Baramati**?"                                                                                  | ▸ the suggestion                                        |
| **Covered, but no record** | "No official record matching _ODR-99_ has been ingested. This may mean the record hasn't been published, or hasn't been collected yet." | ▸ Source registry (S-56) · ▸ Report a data issue (S-78) |

The third case must never be phrased as "this project does not exist." The platform knows what it ingested; it does not know what exists.

---

## Offline

Search degrades to a **local index over saved items and recently-viewed entities**, built in SQLite (FTS5), with an unmissable label: _"Offline — searching your saved items only (24 items)."_ The remote suggest control is disabled with an explanation, not silently inert.

---

## History and privacy

Search history is **on-device only** and never synced without an account. It is clearable from S-17 and S-70.

**Query text is never transmitted to analytics or crash reporting.** The `search_performed` event carries a result-count bucket, the entity types returned, and whether filters were used — nothing else (`.docs/13-observability/observability.md`). This is not a generic privacy nicety: an activist searching a specific contractor before filing an RTI has a real threat model, and a searchable log of that intent should not exist anywhere.

---

## Performance

| Metric                         | Budget                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Keystroke → suggestion painted | ≤ 300 ms p50 on 4G (250 ms debounce + a ≤150 ms cached-edge response)                              |
| Submit → results painted       | ≤ 800 ms p50, ≤ 2.5 s p95                                                                          |
| Zero jank while typing         | suggestions render in a `FlashList`; no layout thrash on each keystroke                            |
| Request hygiene                | every superseded request aborted; responses arriving out of order are discarded by sequence number |

---

## Deep linking

`lokdarpan://search?q=cost%20per%20km&types=project&unitId=7&fy=2024` restores a full search state — the shareable-investigation primitive that partly compensates for having no website (`00-document-audit` PR-1).
