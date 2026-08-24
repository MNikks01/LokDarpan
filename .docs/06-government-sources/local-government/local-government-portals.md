# Local Government Sources

> Urban and rural local bodies — the deepest and least-covered level (`.docs/03-domain/administrative-hierarchy.md`).
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source                                                          | URL                              | Status        | Relevance | Page title (as fetched)             |
| --------------------------------------------------------------- | -------------------------------- | ------------- | --------- | ----------------------------------- |
| **eGramSwaraj (Panchayat planning, accounting & progress)**     | `https://egramswaraj.gov.in/`    | 🔍 DISCOVERED | CRITICAL  | —                                   |
| **Rural Development and Panchayat Raj Department, Maharashtra** | `https://rdd.maharashtra.gov.in` | ✅ VERIFIED   | HIGH      | Homepage                            | ग्रामविकास आणि पंचायत राज विभाग                         | भारत  |
| **Ahilyanagar (Ahmednagar) District**                           | `https://ahmednagar.nic.in`      | ✅ VERIFIED   | MEDIUM    | अहिल्यानगर                          | Official website of Ahilyanagar District Administration | भारत  |
| **Chhatrapati Sambhajinagar (Aurangabad) District**             | `https://aurangabad.gov.in`      | ✅ VERIFIED   | MEDIUM    | जिल्हा छत्रपती संभाजीनगर            | महाराष्ट्र शासन                                         | India |
| **Mumbai Suburban District**                                    | `https://mumbaisuburban.gov.in`  | ✅ VERIFIED   | MEDIUM    | मुंबई उपनगर जिल्हा, महाराष्ट्र शासन | भारताची स्वप्ननगरी                                      | India |

## Structure (`.docs/03-domain/administrative-hierarchy.md`)

```text
District ──┬── RURAL: Zilla Parishad → Panchayat Samiti → Gram Panchayat → Village → Ward
           └── URBAN: Municipal Corporation / Council / Nagar Panchayat / Cantonment → Ward
```

## What exists

| Level            | Identity source                                       | Finance/works source                                          |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| All local bodies | **LGD** ✅ — codes, hierarchy, ward mappings          | —                                                             |
| Gram Panchayat   | LGD ✅                                                | **eGramSwaraj** 🔍 (work-based accounting, physical progress) |
| GP works         | —                                                     | MGNREGA MIS ✅ (verified live; not inventoried)               |
| Districts        | IGOD ✅ (870 portal entries) · LGD ✅ (784 districts) | District portals — catalogued, not assessed                   |
| ULBs             | LGD ✅                                                | **Not identified**                                            |

## The honest position

**This is the weakest-covered level, exactly as `.docs/15-scalability/scalability-plan.md` Phase 4 predicts.**

Identity is solved — LGD gives every local body a code, and 677,367 villages are enumerated. **Finance and works at local-body level are not solved.** eGramSwaraj is the designated system for panchayat accounting and was unreachable from this vantage point; no equivalent for urban local bodies was identified at all.

For `.docs/wireframes/06-unit.md`'s Gram Panchayat screen — which was deliberately designed around sparse data with coverage shown first — this discovery pass **confirms the design assumption was right**. Local-body coverage will be poor, and the app was built for that.

See also [`.docs/06-government-sources/local-government/panchayat-portals.md`](./panchayat-portals.md) and [`.docs/06-government-sources/local-government/municipal-portals.md`](./municipal-portals.md).
