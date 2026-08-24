# Panchayati Raj Sources

> Rural local government: Zilla Parishad → Panchayat Samiti → Gram Panchayat → Village → Ward (`.docs/03-domain/administrative-hierarchy.md`).

Verified 21 August 2026.

## Identity — solved

**Local Government Directory** ✅ `lgdirectory.gov.in` (verified via alternate channel) enumerates every rural local body with a unique code, plus their wards, and tracks changes with government-order references.

Observed coverage relevant here: 7,323 development blocks · 677,367 villages · rural panchayats with ward mappings.

`.docs/05-data-model/database-design.md`'s `admin_unit.pri_code` and the `gram_panchayat`/`village`/`ward` levels can be populated from this.

## Finance and works — not solved

| System             | Role                                                                       | Status                                                                                              |
| ------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **eGramSwaraj**    | MoPR's GP planning, work-based accounting, physical progress and reporting | 🔍 **DISCOVERED** — `egramswaraj.gov.in` unreachable from both verification channels on 21 Aug 2026 |
| **PFMS**           | Fund flow to panchayats                                                    | 🔍 partial — largely authenticated                                                                  |
| **MGNREGA MIS** ✅ | Rural works, employment, expenditure                                       | ✅ verified live at `nrega.nic.in`; **report surface not inventoried**                              |

eGramSwaraj is documented by MoPR as integrating with **LGD** (place codes) and **PFMS** (fund flow) through unique codes. If that integration is publicly queryable, it would give panchayat-level money-in/money-out joined to LGD codes — which is precisely what `.docs/wireframes/06-unit.md`'s Gram Panchayat screen needs.

**It is unverified.** Treat as the second-highest-priority verification target after OMMAS.

## Finance Commission grants

`.docs/03-domain/administrative-hierarchy.md` notes rural finance flows heavily through schemes and Finance Commission grants to GPs. **No source for FC grant releases to individual panchayats was identified in this pass.** PFMS is the likely holder.

## Realistic expectation

`.docs/15-scalability/scalability-plan.md` Phase 4 anticipates "sparse/uneven local publication" and this pass gives no reason to revise that. Expect: **identity complete, money incomplete.** The mobile app's coverage-first design at this level is the correct response.
