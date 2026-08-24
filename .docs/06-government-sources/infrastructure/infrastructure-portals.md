# Infrastructure Sources

> Departments and agencies that build and record physical assets.
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source                                                                  | URL                                       | Status      | Relevance | Page title (as fetched)                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------ |
| **Ministry of Road Transport and Highways (MoRTH)**                     | `https://morth.nic.in/`                   | ✅ VERIFIED | CRITICAL  | Ministry of Road Transport & Highways, Government Of India                                       |
| **Public Works Department, Maharashtra**                                | `https://pwd.maharashtra.gov.in`          | ✅ VERIFIED | CRITICAL  | मुख्यपृष्ठ                                                                                       | सार्वजनिक बांधकाम विभाग                                         | महाराष्ट्र शासन     | भारत |
| **Central Public Works Department (CPWD)**                              | `https://cpwd.gov.in/`                    | ✅ VERIFIED | HIGH      | Home                                                                                             | Central Public Works Department                                 | Government of India |
| **Maharashtra State Road Development Corporation (MSRDC)**              | `https://msrdc.in`                        | ✅ VERIFIED | HIGH      | —                                                                                                |
| **Ministry of Housing and Urban Affairs**                               | `https://mohua.gov.in/`                   | ✅ VERIFIED | HIGH      | —                                                                                                |
| **National Highways Authority of India (NHAI)**                         | `https://nhai.gov.in/`                    | ✅ VERIFIED | HIGH      | National Highways Authority of India, Ministry of Road Transport & Highways, Government of India |
| **Urban Development Department (Nagar Vikas Vibhag), Maharashtra**      | `https://urban.maharashtra.gov.in`        | ✅ VERIFIED | HIGH      | Homepage                                                                                         | नगरविकास विभाग                                                  | भारत                |
| **National Highways & Infrastructure Development Corporation (NHIDCL)** | `https://www.nhidcl.com/`                 | ✅ VERIFIED | MEDIUM    | Home Page                                                                                        | National Highways & Infrastructure Development Corporation Ltd. |
| **Water Resources Department, Maharashtra**                             | `https://wrd.maharashtra.gov.in`          | ✅ VERIFIED | MEDIUM    | मुख्य पृष्ठ - जलसंपदा विभाग, महाराष्ट्र शासन, भारत                                               |
| **Water Supply and Sanitation Department, Maharashtra**                 | `https://water.maharashtra.gov.in`        | ✅ VERIFIED | MEDIUM    | मुख्यपृष्ठ                                                                                       | पाणी पुरवठा व स्वच्छता विभाग                                    | भारत                |
| **Housing Department, Maharashtra**                                     | `https://housing.maharashtra.gov.in`      | ✅ VERIFIED | LOW       | Homepage                                                                                         | गृहनिर्माण विभाग                                                | भारत                |
| **Maharashtra Energy Development Agency (MEDA)**                        | `https://www.mahaurja.maharashtra.gov.in` | ✅ VERIFIED | LOW       | मुख्य पृष्ठ - महाराष्ट्र ऊर्जा विकास एजन्सी                                                      |
| **Maharashtra Housing and Area Development Authority (MHADA)**          | `https://www.mhada.gov.in`                | ✅ VERIFIED | LOW       | MHADA                                                                                            | Maharashtra Housing and Area Development Authority              |
| **Maharashtra State Road Transport Corporation**                        | `https://msrtc.maharashtra.gov.in`        | ✅ VERIFIED | LOW       | Welcome to MSRTC :: Maharashtra State Road Transport Corporation                                 |
| **Motor Vehicles Department (RTO), Maharashtra**                        | `https://transport.maharashtra.gov.in`    | ✅ VERIFIED | LOW       | मोटार वाहन विभाग, महाराष्ट्र                                                                     |

## Domain coverage vs `.docs/15-scalability/scalability-plan.md`

Phase 1 is roads. Later phases widen to health, education, water, power. The catalogue already contains the relevant state departments for those domains — see [`.docs/06-government-sources/igod-organization-catalogue.csv`](../igod-organization-catalogue.csv), category `Departments`.

**None of the non-road infrastructure departments has been assessed.** They are `DISCOVERED` only.

## The recurring gap

Every infrastructure source verified here is a **departmental website**, not a works database. A department site publishes notices, orders and occasionally tender lists. It does not generally publish a queryable register of works with progress and expenditure.

That is the same gap recorded in [`.docs/06-government-sources/infrastructure/project-monitoring-portals.md`](./project-monitoring-portals.md), and it is the central open question of this discovery phase.
