# 15 — Legal & Ethical Rules

**This document is binding on every other document and every component.** Where any spec, feature, model output, or copy conflicts with these rules, these rules win and the feature is withheld. LokDarpan's usefulness depends entirely on its credibility, and its credibility depends on never overstating what the data shows.

## The mandate

LokDarpan presents **facts, calculations, and neutral comparisons** derived from official government records. It is a transparency and mathematical-consistency tool. It is **not** an anti-corruption platform, an accusation engine, or a legal authority.

## Mandatory rules

1. **Never accuse individuals.** No person, official, contractor, or firm is ever characterized as corrupt, dishonest, or guilty. Names appear only inside neutral, descriptive statistics.
2. **Never infer corruption or wrongdoing.** A variance, deviation, delay, or concentration is a _number_. The platform never claims it was caused by theft, fraud, bribery, diversion, or misconduct.
3. **Never make legal statements.** No use of terms like "illegal," "fraud," "embezzlement," "guilty," "violation," or "crime." The platform does not adjudicate.
4. **Show only facts.** Every displayed claim is a figure from an official source or a transparent calculation over such figures.
5. **Every number must be traceable.** No figure is displayed without a link to its source document, extraction method, and retrieval date. (Enforced by the provenance model in [04](../05-data-model/database-design.md).)
6. **Show original source links.** Users can reach the underlying official document for any figure.
7. **Show confidence scores.** Extracted (esp. OCR) figures display their confidence; low-confidence values are labeled and de-emphasized.
8. **Show missing-data warnings.** Absent data is shown explicitly as missing — never imputed, never rendered as zero, never treated as evidence of wrongdoing.
9. **Preserve historical versions.** All prior values (e.g. budget revisions) are retained and viewable; nothing is silently overwritten.

## Allowed vs forbidden language

| ✅ Allowed (neutral, factual)                              | ❌ Forbidden (accusatory/legal/causal) |
| ---------------------------------------------------------- | -------------------------------------- |
| "Budget mismatch detected."                                | "Money was stolen."                    |
| "Data inconsistency found."                                | "This is corruption."                  |
| "Unexplained variance exists."                             | "Funds were diverted."                 |
| "Utilization percentage differs from the district median." | "The contractor overcharged."          |
| "Budget deviation detected."                               | "This official is guilty."             |
| "Records are missing for this period."                     | "They hid the money."                  |
| "Reported cost per km is 35% above the district median."   | "This contractor stole money."         |

"Unexplained variance" means _the data does not explain it_ — not that an explanation is being withheld by someone. This distinction is stated in the UI.

## Enforcement (rules as code, not just policy)

- **Anomaly & report text** is generated from vetted templates; free text passes a neutrality checker before storage/display.
- **AI layer** is bound by the guardrail stack in [11](../09-ai/ai-layer.md): grounding, neutrality classifier, citation enforcement, numeric fidelity; failures fall back to neutral templates or refuse.
- **Risk score** is labeled "Verification Priority / Data Consistency," never "corruption risk," and always shown with its factor breakdown ([07](../08-risk/risk-scoring-engine.md)).
- **UI contract:** no figure renders without source + confidence + as-of; no anomaly without evidence links ([09](../01-product/dashboard-design-legacy.md)).
- **CI gate:** a lint/eval suite scans copy, templates, and sampled AI outputs for forbidden language; a hit blocks release.
- **Read-only values:** no role can edit an ingested figure; corrections are re-ingestions with new versions ([13](../12-security/security.md)).

## Data-sourcing ethics

- **Official sources only.** News, social media, blogs, third-party sites, and user-generated content are never sources of fact.
- **Respect access terms:** honor `robots.txt`, rate limits, and each portal's usage terms; scrape only public, non-authenticated pages; prefer APIs/open-data files.
- **Attribution & licensing:** display the issuing authority and the applicable open-data license/terms for each dataset.
- **No re-identification:** do not combine datasets to expose personal information; minimize incidental PII in display.

## Corrections & right of reply

- A visible **"report a data issue"** path lets anyone (including named departments/contractors) flag an error; corrections are made by re-ingesting from source and are themselves versioned and logged.
- Because the platform makes no allegations, there is nothing to retract _about a person_ — only data to correct. This is by design.

## Positioning statement (for the site & about page)

> LokDarpan compiles official government financial and infrastructure records into a single, source-linked view and checks them for mathematical consistency. It highlights where published figures do not add up or where records are missing, so the public can understand and verify public spending. It does not investigate, accuse, or make legal findings. Every number links to its official source. A difference or gap shown here means the _data_ warrants a closer look — it is not a claim of wrongdoing by any person or organization.

## Disclaimers (shown in-product)

- On anomaly/audit surfaces: _"These are data-consistency observations from official records, not findings of wrongdoing."_
- On estimates (road model): _"Modeled estimates are engineering approximations with stated assumptions; deviations can be legitimate."_
- On low-confidence figures: _"Extracted from a scanned document; value may contain OCR error."_

## Legal review

Before public launch and before each domain expansion, product copy, disclaimers, and methodology are reviewed with legal counsel familiar with Indian defamation, IT, and open-data norms. This document is the checklist for that review.
