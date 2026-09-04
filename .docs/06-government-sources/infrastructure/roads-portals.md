# Roads & Highways Sources

> Phase-1 domain. National highways, state highways, rural roads.
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source                                                                  | URL                              | Status        | Relevance | Page title (as fetched)                                                                          |
| ----------------------------------------------------------------------- | -------------------------------- | ------------- | --------- | ------------------------------------------------------------------------------------------------ |
| **eProcurement System for PMGSY**                                       | `https://pmgsytenders.gov.in`    | ✅ VERIFIED   | CRITICAL  | eProcurement System for Pradhan Mantri Gram Sadak Yojana (PMGSY)                                 |
| **Ministry of Road Transport and Highways (MoRTH)**                     | `https://morth.nic.in/`          | ✅ VERIFIED   | CRITICAL  | Ministry of Road Transport & Highways, Government Of India                                       |
| **National Highways Authority of India (NHAI)**                         | `https://nhai.gov.in/`           | ✅ VERIFIED   | HIGH      | National Highways Authority of India, Ministry of Road Transport & Highways, Government of India |
| **National Highways & Infrastructure Development Corporation (NHIDCL)** | `https://www.nhidcl.com/`        | ✅ VERIFIED   | MEDIUM    | Home Page                                                                                        | National Highways & Infrastructure Development Corporation Ltd. |
| **PMGSY OMMAS (Online Management, Monitoring and Accounting System)**   | `https://online.omms.nic.in/`    | 🔍 DISCOVERED | CRITICAL  | —                                                                                                |
| **Public Works Department, Maharashtra**                                | `https://pwd.maharashtra.gov.in` | ✅ VERIFIED   | CRITICAL  | मुख्यपृष्ठ                                                                                       | सार्वजनिक बांधकाम विभाग                                         | महाराष्ट्र शासन | भारत |
| **Maharashtra State Road Development Corporation (MSRDC)**              | `https://msrdc.in`               | ✅ VERIFIED   | HIGH      | —                                                                                                |

## Road authority map

| Road class                 | Authority               | Source                                                      | Status                                                         |
| -------------------------- | ----------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| National Highways          | MoRTH / NHAI / NHIDCL   | `morth.nic.in` ✅ · `nhai.gov.in` ✅ · `nhidcl.com` ✅      | verified live                                                  |
| **Rural roads (PMGSY)**    | MoRD / NRIDA            | `pmgsytenders.gov.in` ✅ · **OMMAS** ⚖️ `pmgsy.dord.gov.in` | procurement verified; monitoring reachable but licence-blocked |
| State highways / MDR / ODR | State PWD               | MH: `pwd.maharashtra.gov.in` ✅                             | site verified; works data not located                          |
| State expressways          | State road corporations | MH: MSRDC `msrdc.in` ✅                                     | verified live                                                  |
| Urban roads                | ULBs                    | municipal portals                                           | catalogued, not assessed                                       |

This maps onto `.docs/05-data-model/data-models.md` `roadClass` (`NH`/`SH`/`MDR`/`ODR`/`rural`/`urban`) — **the authority differs per class, so each class needs a different source**. A single "roads" connector will not work.

## Cost-model inputs (`.docs/03-domain/road-infrastructure-intelligence.md`)

`.docs/03-domain/road-infrastructure-intelligence.md` needs Schedule of Rates and IRC/MoRTH specifications to compute expected cost.

- **CPWD** ✅ `cpwd.gov.in` — publishes a Schedule of Rates; format not inventoried
- State PWD SoRs — **not located** for Maharashtra in this pass
- IRC codes — IRC is a registered society; its standards are typically **sold, not published free**. `.docs/03-domain/road-infrastructure-intelligence.md`'s coefficient table may not be sourceable from a free official publication. **Flagged as an open licensing question.**
