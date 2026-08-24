# Entity Linking Analysis

> Can records from different government systems be joined into one ledger? This is the question that decides whether LokDarpan is possible.

Verified 21 August 2026.

## The one genuinely good answer: LGD

The **Local Government Directory** (`lgdirectory.gov.in`, ✅ verified via alternate channel) is the Government of India's own answer to the linkage problem for _place_.

|                   |                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner             | Ministry of Panchayati Raj, with the Registrar General of India                                                                                                                                |
| Purpose           | _"unique code to land/region"_ enabling _"interoperability"_ across e-governance applications                                                                                                  |
| Coverage observed | 36 States/UTs · 784 districts · 7,092 sub-districts · 7,323 blocks · **677,367 villages** · 543 parliamentary and 4,116 assembly constituencies · rural and urban local bodies and their wards |
| Access            | 58+ reports; downloads by state/district; **NAPIX API** for registered consumers                                                                                                               |
| History           | Modification tracking with government-order documentation                                                                                                                                      |

**LGD codes are the spine of `.docs/03-domain/administrative-hierarchy.md`'s hierarchy, and they are real, maintained, and already used for integration between MoPR systems — LGD ↔ eGramSwaraj ↔ PFMS interoperate through them.** That is a documented government integration, not an inference.

This is the single most important finding for the data model: the `admin_unit.lgd_code` column in `.docs/05-data-model/database-design.md` is correctly specified, and there is an authoritative source to populate it including historical changes — which matters because districts get created, renamed and split (Ahmednagar → Ahilyanagar appears in the IGOD crawl as exactly this case).

## The linking matrix (§22)

| Entity                  | Key A             | Source A        | Key B           | Source B             | Can link?   | Confidence | Basis                                                                                                                                                                |
| ----------------------- | ----------------- | --------------- | --------------- | -------------------- | ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Place**               | `lgd_code`        | LGD ✅          | `lgd_code`      | eGramSwaraj, PFMS 🔍 | **Yes**     | **High**   | Documented government integration                                                                                                                                    |
| Place                   | `lgd_code`        | LGD ✅          | district portal | IGOD ✅              | Partial     | Medium     | Name matching; IGOD lists 870 district entries vs LGD's 784 — **the two official directories disagree**                                                              |
| Place                   | `census_code`     | LGD ✅          | census datasets | Census 🔍            | Likely      | Medium     | LGD carries census codes; not verified                                                                                                                               |
| **Tender**              | `tender_id`       | State portal ✅ | `tender_id`     | CPPP ✅              | Likely      | Medium     | Same GePNIC lineage on most portals; **not field-verified**                                                                                                          |
| Tender                  | `nit_number`      | State portal ✅ | NIT no.         | department notice    | Partial     | Low        | Format varies by department                                                                                                                                          |
| **Project/work**        | `work_id`         | works-MIS       | `tender_id`     | procurement          | **UNKNOWN** | —          | **No works-MIS located.** This is the critical missing join                                                                                                          |
| **Contractor**          | vendor name       | State portal ✅ | vendor name     | another state ✅     | Partial     | **Low**    | No national registry; fuzzy only (see [`.docs/06-government-sources/procurement/contractor-portals.md`](../06-government-sources/procurement/contractor-portals.md)) |
| Contractor              | —                 | procurement     | `CIN`           | MCA                  | **No**      | —          | No published link identified                                                                                                                                         |
| **Scheme**              | `scheme_code`     | PFMS 🔍         | scheme name     | state budget ✅      | Partial     | Medium     | Codes exist; mapping not verified                                                                                                                                    |
| **Budget head**         | budget head / COA | budget docs ✅  | head            | treasury ✅          | Likely      | Medium     | Standard accounting classification                                                                                                                                   |
| **Expenditure→Project** | —                 | treasury/CGA ✅ | `work_id`       | works-MIS            | **UNKNOWN** | —          | **The chain-breaking gap**                                                                                                                                           |

## The two joins that decide the product

**Join 1 — tender ↔ project.** Procurement systems are organised around a tender. Execution systems are organised around a work. Nothing verified in this pass connects them. Without it, an award cannot be tied to an asset.

**Join 2 — expenditure ↔ project.** Treasury and CGA data is organised by budget head and DDO. `.docs/07-analytics/analytics-engine.md`'s central formula needs expenditure _per project_. Whether any state treasury publishes expenditure attributable to a work ID is **unknown and unverified**.

If both joins fail, LokDarpan can still deliver: budget→allocation at unit level, complete tender/award records, contractor award histories, and audit findings. It could **not** deliver the project-level Money Trail that `.docs/wireframes/08-financial-flow.md` treats as the signature screen. That would be a significant product change, and it should be settled empirically before the ingestion pipeline is designed.

## Recommended resolution order

1. **Adopt LGD as the canonical place key** — populate `admin_unit` from LGD including historical changes. Confidence high, do it first.
2. **Verify OMMAS** from an Indian vantage point — it may resolve Join 1 and Join 2 simultaneously for rural roads.
3. **Field-verify one GePNIC portal end to end** (Maharashtra) — establish exactly which tender fields are public.
4. **Locate a Maharashtra PWD works-MIS**, or establish that none is public.
5. **Defer cross-state contractor identity** to a later phase; treat it as fuzzy-with-confidence, never as fact.
