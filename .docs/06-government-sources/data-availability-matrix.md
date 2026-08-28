# Data Availability Matrix — the Nagpur PWD road chain

**Date:** 2026-08-26 · **Scope:** India → Maharashtra → Nagpur → Roads → individual work, Maharashtra PWD

Phase 1 of the Lokdarpan brief. Every row records what was **checked**, **when**, and **what was found** — not what a source is assumed to hold. Rows never investigated are marked as such rather than estimated, because an untested guess in this table becomes a plan.

The brief's own rules govern this document: _"Do not pretend that unavailable data exists"_ and _"Never fabricate missing data."_

---

## The finding, stated first

**Everything below `Tender` in the project graph is currently unobtainable in Maharashtra through any route this project will use.**

Not difficult — blocked at the source. The money half of the chain is obtainable, complete, and already ingested. The execution half has no public source that has been located.

```text
Budget ────────► Release ────────► Expenditure           OBTAINABLE, ingested
   │
   └──► Scheme ──► Project ──► Admin Approval ──► Technical Sanction
                                                      │
        Tender ──► Bidders ──► Award ──► Contractor ───┘   NO SOURCE LOCATED
           │
           └──► Work Order ──► Execution ──► Payments ──► Completion
                                                              │
                                          Road Asset ─────────┘   NO SOURCE LOCATED
```

---

## Matrix

Confidence is about **our knowledge of the source**, not about the data's quality.

|   # | Information                                      | Source checked                            | Verdict                                                                                                                                                                                                                                                                | Historical      | Machine-readable      | Checked     | Confidence |
| --: | ------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------- | ----------- | ---------- |
|   1 | Departmental budget, release, expenditure        | `beams.mahakosh.gov.in` MISRPT            | **Obtainable** — ingested, 8 yrs × 33 depts                                                                                                                                                                                                                            | FY2019–FY2026   | Yes, after parsing    | 26 Aug      | High       |
|   2 | Scheme- and object-level budget/release/spend    | same, `DepartmentExcelDownload_relasedFD` | **Obtainable** — ingested, 10 yrs, 9,369 rows                                                                                                                                                                                                                          | FY2017–FY2026   | Yes                   | 26 Aug      | High       |
|   3 | Department names                                 | same, `DeptExpAct1.jsp`                   | **Obtainable** — 33 loaded                                                                                                                                                                                                                                             | Yes             | Yes                   | 26 Aug      | High       |
|   4 | Administrative hierarchy (State/UT)              | `lgdirectory.gov.in` citizen views        | **Obtainable** — 36 ingested                                                                                                                                                                                                                                           | Current         | Yes                   | 25 Aug      | High       |
|   5 | Administrative hierarchy (District → Village)    | LGD citizen views                         | **Blocked** — form posts with `captchaAnswer`                                                                                                                                                                                                                          | —               | —                     | 25 Aug      | High       |
|   6 | Hierarchy, sanctioned route                      | NAPIX `dev.napix.gov.in/nic/lgd/`         | **Pending** — account awaiting approval                                                                                                                                                                                                                                | Yes             | Yes (REST/JSON)       | 26 Aug      | High       |
|   7 | PWD works register                               | `pwd.maharashtra.gov.in`                  | **Does not exist publicly** — "Projects" is a photo gallery; Publications holds one item                                                                                                                                                                               | —               | —                     | 25 Aug      | High       |
|   8 | Tender notice, ID, reference, BOQ                | `mahatenders.gov.in`                      | **Blocked** — `robots.txt` `Disallow: /`, served, `Last-Modified` Feb 2016                                                                                                                                                                                             | —               | —                     | 25 Aug      | High       |
|   9 | Award of Contract, winning bid                   | GePNIC `WebTenderStatusLists`             | **Blocked** — `Enter Captcha *` mandatory. Reproduced on TN, Odisha, Kerala, Rajasthan, WB, Punjab                                                                                                                                                                     | —               | —                     | 25 Aug      | High       |
|  10 | Award of Contract (central portal)               | CPPP `eprocure.gov.in`                    | **Blocked** — no `robots.txt`, but Bid Awards and Tender Search CAPTCHA-gated; no bulk export                                                                                                                                                                          | —               | —                     | 25 Aug      | High       |
|  11 | Bidder list, bid values, competition             | GePNIC / CPPP                             | **Blocked** — same gate as 9 and 10                                                                                                                                                                                                                                    | —               | —                     | 25 Aug      | High       |
|  12 | Contractor identity                              | GePNIC / CPPP award records               | **Blocked** — same gate                                                                                                                                                                                                                                                | —               | —                     | 25 Aug      | High       |
|  13 | Maharashtra procurement via open API             | `api.data.gov.in`                         | **Absent** — 0 Maharashtra procurement datasets among 285,974 resources                                                                                                                                                                                                | —               | —                     | 25 Aug      | High       |
|  14 | Procurement, other states                        | `api.data.gov.in`                         | **Obtainable elsewhere** — Assam 6 yrs, AP 4, Punjab 2, TN 2, Jharkhand 1                                                                                                                                                                                              | 2016-17→2021-22 | Yes, with free key    | 25 Aug      | Medium     |
|  15 | Active tenders, rolling window                   | GePNIC landing `/nicgep/app`              | **Partial** — ~21 current tenders, no CAPTCHA. No archive, no awards                                                                                                                                                                                                   | Forward only    | Yes                   | 25 Aug      | High       |
|  16 | Work order, agreement number                     | —                                         | **No source located**                                                                                                                                                                                                                                                  | —               | —                     | 25 Aug      | High       |
|  17 | Contract extensions, variation orders            | —                                         | **No source located**                                                                                                                                                                                                                                                  | —               | —                     | 25 Aug      | High       |
|  18 | Physical / financial progress per work           | —                                         | **No source located**                                                                                                                                                                                                                                                  | —               | —                     | 25 Aug      | High       |
|  19 | Completion / commissioning certificate           | —                                         | **No source located**                                                                                                                                                                                                                                                  | —               | —                     | 25 Aug      | High       |
|  20 | Administrative Approval, Technical Sanction      | —                                         | **Not investigated**                                                                                                                                                                                                                                                   | —               | —                     | —           | —          |
|  21 | DPR, estimate, measurement book                  | —                                         | **Not investigated.** Measurement books are ordinarily internal records                                                                                                                                                                                                | —               | —                     | —           | —          |
|  22 | Officer postings, transfer orders                | —                                         | **Not investigated**                                                                                                                                                                                                                                                   | —               | —                     | —           | —          |
|  23 | Contractor registration / class                  | Maharashtra PWD                           | **Not investigated**                                                                                                                                                                                                                                                   | —               | —                     | —           | —          |
|  24 | Vigilance & Quality Control reports              | —                                         | **Not investigated**                                                                                                                                                                                                                                                   | —               | —                     | —           | —          |
|  25 | CAG / AG Maharashtra audit reports               | `cag.gov.in` audit reports, state id 79   | **Obtainable — but a sample, not a register.** No `robots.txt`, no CAPTCHA, no login. Carries contractor, contract value and responsible officer for _audited_ works only                                                                                              | 2024–2026 seen  | PDF, needs extraction | 26 Aug      | High       |
|  26 | Government Resolutions (GR)                      | Maharashtra GR repository                 | **Not investigated**                                                                                                                                                                                                                                                   | —               | —                     | —           | —          |
|  27 | PMGSY rural road works                           | OMMAS, now `pmgsy.dord.gov.in`            | **Located and reachable — but licence-blocked.** Publishes work-level agreement, contractor, progress, completion and final-bill data. NRIDA terms forbid copying or republication without written permission — [`pmgsy-ommas-findings.md`](./pmgsy-ommas-findings.md) | Yes             | Yes, 92 report routes | 28 Aug      | High       |
|  28 | NHAI / MoRTH national highways                   | `nhai.gov.in`, `morth.nic.in`             | **Not investigated** beyond reachability                                                                                                                                                                                                                               | —               | —                     | 21 Aug      | Low        |
|  29 | MSRDC, MSIDC, NMC, Zilla Parishad works          | —                                         | **Not investigated**                                                                                                                                                                                                                                                   | —               | —                     | —           | —          |
|  30 | Road geometry (government)                       | —                                         | **No source located** in any checked source                                                                                                                                                                                                                            | —               | —                     | 26 Aug      | Medium     |
|  31 | Road geometry (non-government)                   | OpenStreetMap                             | **Obtainable**, but not a government source — evidence level C at best                                                                                                                                                                                                 | Yes             | Yes                   | not fetched | Medium     |
|  32 | Licence and terms of use, **every** source above | publisher copyright policies              | **Resolved for the three sources in use.** LGD and CAG permit republication with prominent attribution; BEAMS requires written permission first — [`source-licences.md`](./source-licences.md)                                                                         | —               | —                     | 28 Aug      | High       |

---

## What the Nagpur MVP needs, and its status

The brief's MVP is 10–20 real Nagpur road projects with a complete chain. Against this matrix:

| Chain link the MVP needs            | Status                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Nagpur district identity, sub-units | Blocked on **rows 5/6** — NAPIX key pending             |
| Which PWD divisions cover Nagpur    | Not investigated; the PWD site is a communications site |
| Roads belonging to each division    | **No source (row 7)**                                   |
| Tender per road                     | **Blocked (row 8)**                                     |
| Contractor per tender               | **Blocked (row 12)**                                    |
| Timeline, extensions, completion    | **No source (rows 16–19)**                              |
| Officers responsible at the time    | **Not investigated (row 22)**                           |
| Documents proving each claim        | **No source** for the execution half                    |
| Road geometry                       | **No government source (row 30)**                       |

**Nothing in the Nagpur chain below "district" is currently obtainable.** Assembling 10–20 evidence-backed Nagpur road projects from public sources is not possible today, and the brief forbids assembling them any other way.

---

## What this document does not claim

It does not say the records are unpublished. Rows 16–19 say **no source was located**, which under this registry's standing rule is a different claim: _"X was not identified in the sources reviewed as of \[date\]."_

Rows 20–26 have not been examined and may change the picture — particularly **CAG audit reports (row 25)**, which reproduce contract values, completion dates and audit observations for selected works, and are published.

It also does not say the data is unreachable by any means. It says it is unreachable by the means this project has committed to: no CAPTCHA circumvention, no ignoring `robots.txt`, no credentialed access. Those commitments are in [`access-and-permissions.md`](./access-and-permissions.md), and the brief restates them at §42.

---

## Consequences for scope

Three options, stated without preference:

1. **Money-first MVP.** Ship department and scheme level for Maharashtra — real, complete, ingested, verifiable today. Defers the road-level map the brief treats as the primary interface.
2. **Change state.** Assam publishes procurement through an open API (row 14). Not checked for road-level detail, and its treasury depth is unverified.
3. **Change access model.** RTI for named works, or written permission for Mahatenders. RTI does not scale to a dataset; permission is slow and uncertain.

### CAG, examined 26 Aug — the finding that changes the options

`cag.gov.in` publishes Maharashtra audit reports as bilingual PDFs. No `robots.txt` is served, there is no CAPTCHA and no login. The Nagpur compliance audit (Report No. 4 of 2026, 337 pages) contains passages of exactly the kind the execution half needs:

> "…by the Executive Engineer (EE), MJP, Beed to M/s. Mahavir Electro Mechanical Pvt. Ltd., Akola (Contractor) for ₹ 15.14 crore."

Responsible officer, office, contractor and contract value in one sentence — the links blocked on every procurement portal.

**But CAG audits a sample.** Across 169 English pages that report mentions "Public Works" 21 times, "road" 11 times and "contractor" 5 times. It examines selected works; it is not a register of works. Reports are also **bilingual with the Marathi half first**, so an extraction pass that reads only the opening pages will find nothing and wrongly conclude the source is empty.

This changes what is possible in a specific way:

- **A small, deeply-evidenced set of works is achievable** — where CAG audited them, the full chain including contractor, value and officer is public and citable.
- **Comprehensive coverage is not.** "All Nagpur PWD roads" cannot come from CAG, because CAG never set out to list them.

So the brief's MVP of 10–20 evidence-backed works may be reachable, while the expansion path it implies — all Nagpur, then all Maharashtra — is not reachable from this source.

---

## Next checks, in order of expected value

1. **CAG / AG Maharashtra audit reports** (row 25) — the only unexamined source that plausibly carries contract values, contractors and completion dates for real works.
2. **Maharashtra GR repository** (row 26) — administrative approvals are issued as GRs.
3. **Officer postings** (row 22) — transfer orders are often published.
4. **NAPIX**, once approved (row 6) — unblocks Nagpur as an addressable place.
5. ~~**Licence and terms** (row 32)~~ — **done for the three sources in use** ([`source-licences.md`](./source-licences.md)). One blocker remains and it is specific rather than general: BEAMS requires written permission before its figures may be published, and BEAMS supplies every monetary figure the site renders.
