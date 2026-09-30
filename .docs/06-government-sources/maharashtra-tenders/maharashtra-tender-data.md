# Maharashtra Tender Data — Source Research & Ingestion Strategy

**Research date:** 2026-09-30 · **Last verified:** 2026-09-30 for every endpoint marked _Verified_ below.
**Companion documents:** [`maharashtra-sources.md`](./maharashtra-sources.md) (source inventory) · [`../../04-data-engineering/maharashtra-tender-ingestion.md`](../../04-data-engineering/maharashtra-tender-ingestion.md) (architecture and backlog).
**Builds on:** [`../gepnic-access-findings.md`](../gepnic-access-findings.md) · [`../access-and-permissions.md`](../access-and-permissions.md) · [`../datagovin-api-findings.md`](../datagovin-api-findings.md) · [`../tender-ingestion-plan.md`](../tender-ingestion-plan.md) · [`../phase-1-maharashtra-roads.md`](../phase-1-maharashtra-roads.md).

> **The goal is not to find a way around the Maharashtra CAPTCHA.** The goal is a resilient, legitimate, evidence-based Maharashtra procurement ingestion system in which MahaTenders is one source among many, and neither its CAPTCHA nor its crawl policy is a single point of failure.

### Confidence labels

| Label          | Meaning                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------- |
| **Verified**   | Fetched on 2026-09-30; HTTP status, final URL and content inspected                          |
| **Likely**     | Strongly indicated by official material, but the specific claim was not confirmed end to end |
| **Unverified** | Seen only in a search-engine result or a third party's own description                       |
| **Unknown**    | Not established. Needs a crawl experiment, a permitted fetch, or a question to the publisher |

**Method.** `robots.txt` was read before any page on every host. Two network channels were used, as the registry rule requires: **channel 1**, direct HTTPS fetches from a developer machine in India identifying as `LokDarpan/0.1 (+https://github.com/MNikks01/LokDarpan)`, sequential, at least one second apart; **channel 2**, a hosted search and fetch service (Firecrawl), used for `site:`-restricted discovery on official domains and as a second vantage point. No URL here was written from memory: each was discovered from an official page or an official-domain search, then fetched. A host that did not answer is recorded as _not reachable from the verification vantage point on 2026-09-30; existence not disproven_.

---

## 1. Executive Summary

1. **The problem is not only CAPTCHA — it is also the crawl policy.** `mahatenders.gov.in/robots.txt` is `User-agent: * / Disallow: /` (_Verified_, unchanged since 2026-08-25). CAPTCHA gates its search and award pages; `robots.txt` asks automated agents not to collect **any** of it. LokDarpan honours `robots.txt` always, so even the CAPTCHA-free MahaTenders landing page is not collected.
2. **PWD's own "Notice Inviting Tender" system is also closed to crawlers.** PWD's current website links its NIT service to a single legacy URL, `http://mahapwd.gov.in/nit/default.asp`. That host is live, server-rendered and CAPTCHA-free — and its `robots.txt` is `User-agent: * / Disallow: /` (_Verified_; [`../evidence-mahapwd-robots.txt`](../evidence-mahapwd-robots.txt)). **Both PWD-specific procurement surfaces have asked not to be crawled.** The assumed first priority, "Maharashtra PWD official NIT", cannot be the first automated source without written permission.
3. **Several Maharashtra agencies publish their own tender notices on hosts that permit crawling, with no CAPTCHA, as server-rendered HTML with PDFs.** The strongest:
   - **MSIDC** (`msidc.org/tenders/`) — page titled _"E-Tenders for Maharashtra PWD Projects"_; 290 notices from Feb 2024 to Jul 2026 on one page; born-digital PDFs carrying notice number, dates, fee, EMD, and a pointer to MahaTenders. **The most direct legitimate surface for PWD-programme works.**
   - **MHADA** (`www.mhada.gov.in/mr/tenders`) — 455 pages, about 4,547 notices, back to **25 July 2016**; each row carries publication date, official reference, board, closing date and PDF. 2016-era references follow the **MahaTenders tender-ID pattern** (`२०१६-म्हाडा-१४०९४५-१`), a cross-walk key to MahaTenders that needs no access to it.
   - **MMRDA** (archive table, 21 pages), **MSRDC** (tender number `T 2943`), **MEDA** (about 760 rows), **DGIPR** (scanned notices), **CIDCO** (sparse), and **MSEDCL** (its own non-GePNIC e-tender portal).
4. **PWD's main website publishes works and budget documents that partly address the "no works register" gap** recorded in the 2026-09-29 audit: region-wise **Roads and Bridges project lists** (one row per work: region, budget head, road class, road number, km chainage, district, taluka, amounts) and **Performance Budgets 2021-22 to 2024-25**, on a CDN that states no crawl restriction. These are _Work_ and _Budget_ records, not tenders — the PWD records a tender would later be joined to.
5. **No publicly documented official API** for MahaTenders, GePNIC, or Maharashtra procurement was found during this research. `data.gov.in` held no Maharashtra public-procurement dataset on 2026-08-25; it was not reachable from either vantage point on 2026-09-30, so that finding was not re-confirmed today.
6. **Coverage has a statutory floor.** e-Tendering was made mandatory above ₹50 lakh from 1 December 2010 and then from ₹10 lakh (_Verified_, _State of e-Governance in Maharashtra 2013_, p. 66); official publications indicate a later reduction to ₹3 lakh (_Likely_). Smaller works may never be e-tendered, and no source here covers them.

**In one line:** build a multi-source ingestion from official publishers on the machinery LokDarpan already has (R2 raw store, `source_artifact`, `document` and `document_fact`, `tender` and `tender_version`), starting with **MHADA and MSIDC notices**; add PWD's works lists as the Work layer; and **ask PWD in writing for permission to collect `mahapwd.gov.in/nit/`** in parallel — the single request most likely to unlock PWD tender coverage. Full recommendation: §38.

---

## 2. LokDarpan Context

LokDarpan links official records along Revenue → Budget → Department → State → District → Local body → Scheme → Work → Tender → Contractor → Award → Execution → Expenditure → Audit, and shows each fact with the document it came from ([`../../17-legal/legal-ethical-rules.md`](../../17-legal/legal-ethical-rules.md)). Phase 1 is Maharashtra PWD roads ([`../phase-1-maharashtra-roads.md`](../phase-1-maharashtra-roads.md)).

Three repository rules govern everything below:

- **`robots.txt` is honoured, always.** A `Disallow: /` ends automated collection from that host.
- **Absence is described as our holdings, never as the government's.** "X was not identified in the sources reviewed as of 2026-09-30" — never "the government does not publish X".
- **Collecting is not republishing.** Whether a document may be stored for evidence and whether its contents may be shown are separate questions ([`../source-licences.md`](../source-licences.md), ADR-056 _a tender is linked to, not reproduced_).

## 3. Original Data Acquisition Approach

The Phase-1 plan took `mahatenders.gov.in` as the procurement source (row 2 of [`../phase-1-maharashtra-roads.md`](../phase-1-maharashtra-roads.md)) and a GePNIC connector reading listings, details and awards. That connector exists (`services/ingestion/src/gepnic/`) and runs nightly against 21 other states' GePNIC portals, reading only each portal's CAPTCHA-free landing page ([`../tender-collection-cadence.md`](../tender-collection-cadence.md)).

## 4. Problem Encountered

On 2026-08-25 two findings closed MahaTenders to automated collection ([`../access-and-permissions.md`](../access-and-permissions.md), [`../gepnic-access-findings.md`](../gepnic-access-findings.md)):

1. `mahatenders.gov.in/robots.txt` is `Disallow: /` — one of two State/UT portals of 36 that say so (the other is Karnataka's).
2. On every GePNIC deployment reached, the pages listing tenders by organisation, location or recency, and the Award-of-Contract page (`WebTenderStatusLists`), require a CAPTCHA.

**Re-verified 2026-09-30:** `https://mahatenders.gov.in/robots.txt` → HTTP 200, `User-agent: * / Disallow: /`.

## 5. CAPTCHA Problem

From [`../gepnic-access-findings.md`](../gepnic-access-findings.md) (tested on Tamil Nadu and reproduced on five other states; the platform is the same in Maharashtra):

| GePNIC page                                    | CAPTCHA | Data without it     |
| ---------------------------------------------- | ------- | ------------------- |
| `/nicgep/app` landing                          | No      | ~20 current tenders |
| `FrontEndLatestActiveTenders`                  | Yes     | None                |
| `FrontEndTendersByOrganisation` / `ByLocation` | Yes     | None                |
| `WebTenderStatusLists` (Award of Contract)     | Yes     | None                |
| CPPP `resultoftendersnew` (Bid Awards)         | Yes     | None                |

**What CAPTCHA takes away:** search by organisation or location, the full active list, and **every award result** (winner, awarded value). **What remains elsewhere:** the notices themselves, published by the issuing agencies (§§12–19).

For Maharashtra the CAPTCHA question is secondary: `Disallow: /` already excludes every MahaTenders page from automated collection, including the landing page.

## 6. Why CAPTCHA Bypass Is Not Acceptable

A CAPTCHA is the publisher stating that access should be interactive. Solving it by OCR, by a paid solving service, by a scripted browser, or by calling an endpoint seen in the page's network traffic would each defeat an access control the publisher chose. For a platform whose only asset is that its figures are trustworthy and lawfully obtained, a dataset built that way is worthless: every figure would carry the question of how it was obtained. The repository has ruled this out since 2026-08-25 ([`../access-and-permissions.md`](../access-and-permissions.md) §"What we do not do"), and nothing in this research changes that. See §37.

## 7. Maharashtra Procurement Ecosystem

Observed on 2026-09-30:

- **MahaTenders** (`mahatenders.gov.in`) — the state's GePNIC deployment, where bids are submitted. Agency material confirms the role: MSIDC notices require bidders to enrol on it; MMRDA, MSRDC and PWD link to it; DGIPR's EOI letters direct bidders to it.
- **Agency publication pages** — most agencies examined also publish the notice inviting tender on their own website, as HTML listings with PDFs. These are what this document recommends ingesting.
- **Agency e-tender systems outside GePNIC** — MSEDCL (`etender.mahadiscom.in`), MIDC (`wms1.midcindia.org/eproc`), MHADA's e-auction portal (`eauction.mhada.gov.in`).
- **The PWD legacy NIT system** (`mahapwd.gov.in/nit/`) — a department listing of notices and works, linked from PWD's current website.
- **The statutory floor** — e-tendering mandatory above ₹50 lakh from 1 Dec 2010, then from ₹10 lakh (_Verified_, _State of e-Governance in Maharashtra 2013_, p. 66: "from 1st December 2010, e-Tendering was made mandatory … for tenders whose estimated value is greater than ₹50 lakhs … Following this on 19th January, Government of Maharashtra issued a GR making e-Tendering mandatory for the Project / Purchases whose cost is ₹10 Lakhs and above"); lowered to ₹3 lakh according to the 2014 edition and DGIPR's _Maharashtra Ahead_ of November 2015 (_Likely_ — seen in the documents' indexed text; the 2014 PDF did not extract cleanly).

**The pattern: one bidding system, many publishers.** Bids are submitted on MahaTenders; the notice inviting them is published by the agency that issues it. So the notice can be reached through its issuer even when the bidding system cannot.

## 8. MahaTenders / GePNIC

| Question                   | Finding                                                                                                                                                                     | Confidence                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| What it is                 | Maharashtra's deployment of GePNIC, NIC's e-procurement product, used by about 28 states and CPPP                                                                           | Verified                                            |
| `robots.txt`               | `User-agent: * / Disallow: /`                                                                                                                                               | Verified                                            |
| CAPTCHA                    | Search, full lists and awards (platform-wide)                                                                                                                               | Verified on other GePNIC states; platform identical |
| Official API / bulk export | **No publicly documented official API was found during this research.** Searches of NIC, CPPP and Maharashtra domains found none                                            | Verified as absent from the sources reviewed        |
| Tender-ID format           | `YEAR_ORG_NUMBER_N` on GePNIC; MHADA publishes references of that shape (§14)                                                                                               | Likely                                              |
| Role for LokDarpan         | **Identifier namespace and link target**, not a collected source. Agency notices cite MahaTenders IDs; LokDarpan stores them and links to the portal, which it never crawls | Recommendation                                      |

The route that remains open is written permission ([`../mahatenders-access-request-draft.md`](../mahatenders-access-request-draft.md) — drafted, not sent).

## 9. Maharashtra PWD

`https://pwd.maharashtra.gov.in/` — Public Works Department, Government of Maharashtra. An S3WaaS WordPress site; Marathi by default, English under `/en/`.

| Property               | Finding                                                                                                                                                                                 | Confidence |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `robots.txt`           | `Disallow: /wp-admin/` only — the public site may be crawled                                                                                                                            | Verified   |
| Tender listing on site | **None.** Notice categories are _General announcements_, _Seniority lists_ and _Recruitment_. The homepage's tender "Read more" button links to `https://mahatenders.gov.in/nicgep/app` | Verified   |
| NIT service page       | `https://pwd.maharashtra.gov.in/en/service/notice-inviting-tender/` — its body is the single line _"Visit : http://mahapwd.gov.in/nit/default.asp"_                                     | Verified   |
| Documents              | `document-category/` pages: Budget (`अर्थसंकल्प`), Roads & Bridges (`रस्ते-आणि-पूल`), GRs, Cabinet decisions, circulars, RTI, reference books. Files on `cdnbbsr.s3waas.gov.in`         | Verified   |
| Document CDN policy    | `cdnbbsr.s3waas.gov.in/robots.txt` → HTTP 404 `NoSuchBucket` (no stated restriction)                                                                                                    | Verified   |

## 10. PWD NIT System

`http://mahapwd.gov.in/nit/default.asp` — where PWD's current website sends readers for Notices Inviting Tender.

**Access policy (decisive).** `http://mahapwd.gov.in/robots.txt` → HTTP 200, `User-agent: * / Disallow: /` (_Verified_; evidence in [`../evidence-mahapwd-robots.txt`](../evidence-mahapwd-robots.txt)). **LokDarpan does not collect from this host.** One landing-page fetch was made in the same request sequence that read `robots.txt`, before its content was read; no detail page, search or PDF on the host was requested afterwards. What that page showed is recorded because it determines how much a permission request is worth:

| Question                                      | Answer from the single landing page                                                                                                   | Confidence                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Does it still work?                           | Yes. HTTP 200 over `http://`; `https://` fails (incomplete certificate chain). Server `openresty`, classic ASP, session cookie        | Verified                           |
| CAPTCHA / authentication                      | None on the landing page                                                                                                              | Verified                           |
| Server-rendered HTML                          | Yes                                                                                                                                   | Verified                           |
| Predictable URL structure                     | Detail pages `/nit/Tender.asp?nitno=<integer>` (e.g. `80273`, `80354`); forms post to `/nit/tenderindex.asp`, `/nit/1tenderindex.asp` | Verified (links seen, not fetched) |
| Browse by region / division                   | Regions: Amravati, Pune, Mumbai, Aurangabad, Nashik, Nagpur, Special Project, C.E. Electrical, Chief Architect, Mantralaya            | Verified (links seen)              |
| Browse by district                            | 36 district links                                                                                                                     | Verified (links seen)              |
| Search by date                                | "Submission / Form Issue Date ends (dd/mm/yyyy)" and "Advanced Search"                                                                | Verified (form seen)               |
| Search by tender number                       | Not established                                                                                                                       | Unknown                            |
| Volume                                        | "Online Tenders Notices : 35 · Number Of Works : 85" on 2026-09-30 — **a notice bundles several works**                               | Verified                           |
| Estimated costs                               | Shown (e.g. ₹2,32,46,79,764 for a Samruddhi interchange road, Nashik division)                                                        | Verified                           |
| Office / division                             | Shown (e.g. "P.W. DIVISION, NASHIK")                                                                                                  | Verified                           |
| Accepted tenders                              | A "Tenders Accepted — click here for details" link exists; not examined                                                               | Unknown                            |
| PDFs                                          | Under `/Nit/…`: non-DSR rate notices 2017–2020, auction notices 2020–2024, EOIs 2015–2020                                             | Verified (links seen, not fetched) |
| Historical depth, EMD, dates, BOQ, corrigenda | Not examined                                                                                                                          | Unknown                            |
| Relationship to MahaTenders                   | The statistics say "Online Tenders Notices", indicating e-tenders whose bidding runs on MahaTenders; not confirmed from a detail page | Likely                             |

**Conclusion.** The PWD NIT system is the PWD-scoped, CAPTCHA-free register browsable by division and district that LokDarpan wants — and its publisher has asked crawlers to stay away. It is the most valuable **permission request** in this document (§38; backlog `MHA-TENDER-002`).

## 11. PWD Official Documents

| Document                                                                                                              | Where                                                                                                                     | What it holds                                                                                                                                                                                                                                                                                                                                       | Confidence              |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Roads & Bridges project lists**, one per region (Chhatrapati Sambhajinagar, Nanded, Nashik, Konkan, Pune parts 1–2) | `pwd.maharashtra.gov.in/document-category/रस्ते-आणि-पूल/` → PDFs on `cdnbbsr.s3waas.gov.in/…/uploads/2025/04/…` (2–10 MB) | The Chhatrapati Sambhajinagar list: 32 pages. Each row: serial, region, a two-digit code, road class (`CRF`, `SH`, `MDR`…), a work description naming **district, taluka, road number and km chainage** (e.g. "रामा 214 किमी 112/00 ते 114/00"), sometimes a **CRIF job number with date**, then five numeric columns (e.g. `996.00 2.00 0.00 0 0`) | Verified (one PDF read) |
| Meaning of the numeric columns                                                                                        | —                                                                                                                         | Headers are not in the extracted text; plausibly cost (₹ lakh) and length (km), **not established**                                                                                                                                                                                                                                                 | Unknown                 |
| Text encoding                                                                                                         | —                                                                                                                         | A legacy Devanagari font: text extracts with substituted glyphs (`छĝपती` for `छत्रपती`). Needs glyph remapping or OCR — the class of problem `services/ingestion/src/cag/extract.ts` already detects                                                                                                                                                | Verified                |
| **Performance Budgets** 2021-22 to 2024-25; budget books from 2011-12                                                 | `document-category/अर्थसंकल्प/` (31 entries)                                                                              | Department performance budget; contents not examined                                                                                                                                                                                                                                                                                                | Verified (listing)      |
| Environmental-clearance compliance uploads                                                                            | `notice/…` (e.g. the Moshi court complex, 14/08/2026)                                                                     | Project documents, not tenders                                                                                                                                                                                                                                                                                                                      | Verified                |
| PWD NIT PDFs, BOQs, corrigenda, award notices                                                                         | `mahapwd.gov.in/Nit/…`                                                                                                    | Not collected — the host disallows crawling                                                                                                                                                                                                                                                                                                         | —                       |

These are **Work** and **Budget** records. They do not replace tender notices, but they give each road work an identity (road number + chainage + job number) that a tender notice for the same work can later be matched against.

## 12. MSIDC

`https://msidc.org/tenders/` — Maharashtra State Infrastructure Development Corporation Ltd (CIN `U43900MH2023SGC412992`), a Government of Maharashtra undertaking that executes PWD-programme road and building works.

| Property          | Finding                                                                                                                                                                                                                                                                                                                      | Confidence          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Page title        | _"E-Tenders for Maharashtra PWD Projects - MSIDC"_                                                                                                                                                                                                                                                                           | Verified            |
| `robots.txt`      | `/wp-admin/` only; publishes sitemaps                                                                                                                                                                                                                                                                                        | Verified            |
| CAPTCHA / auth    | None                                                                                                                                                                                                                                                                                                                         | Verified            |
| Listing           | One server-rendered table, **290 rows**, no pagination. Columns: Sr. No · Publication Date · Last Date/Time of Submission · Name of Work · Tender Notice (PDF)                                                                                                                                                               | Verified            |
| Historical depth  | 26 Feb 2024 (row 290) to 6 Jul 2026 (row 1)                                                                                                                                                                                                                                                                                  | Verified            |
| Work descriptions | Road works name the road, MDR number, km range, taluka and district (e.g. _"MDR-130, Km. 0/00 to 12/000 Ta. Chimur Dist. Chandrapur … on EPC mode"_)                                                                                                                                                                         | Verified            |
| PDFs              | `msidc.org/wp-content/uploads/<yyyy>/<mm>/…pdf`; born-digital (text extracts cleanly)                                                                                                                                                                                                                                        | Verified (two read) |
| PDF contents      | Notice number (_"E-Tender Notice No. 09 (2026-2027)"_, _"E-TENDER NOTICE NO.06 OF 2023-2024"_), office reference (_"No. MSIDC/Mumbai/Tender/ 55 /2024"_), dates of issue, pre-bid meeting, submission and opening, tender fee, EMD, eligibility and selection method; states that bids are submitted on `mahatenders.gov.in` | Verified            |
| Data quality      | Some rows give a deadline year earlier than publication (row 289: published 01-Mar-2024, deadline 08-Mar-**2023**). The listing must not be trusted over the PDF                                                                                                                                                             | Verified            |
| Estimated cost    | Not in the two notices read; a multi-package EPC notice lists works without values on page 1                                                                                                                                                                                                                                 | Partially available |
| Update frequency  | Irregular, in bursts (many notices in March 2024 and July 2026)                                                                                                                                                                                                                                                              | Likely              |

## 13. MMRDA

`https://mmrda.maharashtra.gov.in/` — Mumbai Metropolitan Region Development Authority (Drupal).

| Property        | Finding                                                                                                                                                                                                    | Confidence |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `robots.txt`    | Drupal default (disallows `/admin/`, `/search/`, `/user/…`); tender pages permitted                                                                                                                        | Verified   |
| Current notices | `/mr/tenders/tender-notices` (and `/en/…`) — list rendered client-side; the server HTML carries no rows                                                                                                    | Verified   |
| **Archive**     | `/mr/tenders/tender-notices/archive` — server-rendered table, **21 pages** (`?page=0…20`). Columns: tender reference no. (often blank), division, type (Tender / Notice), title, issue date, end date, PDF | Verified   |
| PDFs            | `/sites/default/files/<yyyy-mm>/…pdf`, including corrigenda (e.g. `notice_corri_4_date_extn_plot_tender_22_09_2026.pdf`)                                                                                   | Verified   |
| MahaTenders     | Linked from the site navigation                                                                                                                                                                            | Verified   |
| Scope           | Land-lease tenders, administrative rate contracts and works together                                                                                                                                       | Verified   |

## 14. MHADA

`https://www.mhada.gov.in/mr/tenders` — Maharashtra Housing and Area Development Authority and its regional boards (Drupal).

| Property         | Finding                                                                                                                                                                                                                                      | Confidence                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `robots.txt`     | Drupal default; tender pages permitted                                                                                                                                                                                                       | Verified                                                        |
| CAPTCHA / auth   | None                                                                                                                                                                                                                                         | Verified                                                        |
| Listing          | Server-rendered table, 10 per page, **pages 0–454**. Columns: serial · e-publication date · title with running notice number (_"ई निविदा सूचना क्र. ३७३९"_) · **reference / tender no.** · board · document description · closing date · PDF | Verified                                                        |
| Historical depth | Oldest row **25 July 2016**; about 4,547 rows                                                                                                                                                                                                | Verified                                                        |
| Filter           | By board: MHADA, Mumbai Housing, Mumbai Building Repair & Reconstruction, Mumbai Slum Improvement, Konkan, Pune, Nashik, Aurangabad, Nagpur, Amravati                                                                                        | Verified                                                        |
| Freshness        | Four notices dated 29–30 September 2026 on the day checked                                                                                                                                                                                   | Verified                                                        |
| **Identifier**   | 2016 rows carry references such as `२०१६-म्हाडा-१४०९४५-१` — the GePNIC tender-ID shape (`2016_MHADA_140945_1`) in Devanagari. Recent rows carry office references (`का.अ. (पश्चिम) / मुं.झो.सु.मंडळ/ई-निविदा/ १३४ / २०२६-२७`)                | Verified (pattern) · Likely (that it equals the MahaTenders ID) |
| PDFs             | `/sites/default/files/TN_No_<n>-<office>-<dd-mm-yyyy>.pdf`                                                                                                                                                                                   | Verified                                                        |
| Related          | E-auction portal `eauction.mhada.gov.in` (separate; not examined)                                                                                                                                                                            | Verified (link)                                                 |

## 15. MSEDCL

Maharashtra State Electricity Distribution Co. Ltd (Mahavitaran).

| Property            | Finding                                                                                                                                                                                                       | Confidence                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Own e-tender portal | `https://etender.mahadiscom.in/` — **not GePNIC**: Latest Tenders (Works / Procurement), Announcements, Forward and Reverse Auction                                                                           | Verified                     |
| `robots.txt`        | `etender.mahadiscom.in/robots.txt` → 404 (no stated restriction); `www.mahadiscom.in` → empty `Disallow:` (all permitted)                                                                                     | Verified                     |
| Works list          | `/eatApp/latestTendersWorks` — the server HTML carries only the header row: Tender No · Description · Purchase From/To Date · Technical Bid Open Date · Submission Due · Tender Fee (Rs). Rows load by script | Verified                     |
| Data endpoint       | **Not examined.** A script-loaded list is not gated, but an endpoint found by reading network traffic is not a documented interface. Ask MSEDCL for a feed, or use its announcements page                     | Unknown                      |
| Main-site notices   | `www.mahadiscom.in/en/…` posts individual e-tender notices (e.g. an RfS for 2000 MW / 4000 MWh battery storage; "T-13(21-22) of Chandrapur Circle", marked Archived)                                          | Unverified (search results)  |
| Tender numbering    | e.g. `BILLING/EE/JSPDIV/HTK/T-22/09-2026`, `EE/BHR/TECH/26-27/BILLING/T-02`                                                                                                                                   | Unverified (search excerpts) |

## 16. MEDA / MAHAURJA

`https://mahaurja.maharashtra.gov.in/Site/1607/Tenders-EoI-Offers` (`www.mahaurja.com` redirects here).

| Property      | Finding                                                                                                                                  | Confidence |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `robots.txt`  | Disallows `/search` and `/admin`; tender pages permitted                                                                                 | Verified   |
| CAPTCHA       | The site loads Google reCAPTCHA's script on every page, but the tender table renders in full without any interaction                     | Verified   |
| Listing       | About 760 rows of "Particulars / Details", each with notice and quotation PDFs under `/Site/Upload/pdf/`; notice numbers like `२६-२७/५८` | Verified   |
| Dates, values | Not separate columns; in the PDFs                                                                                                        | Likely     |
| Historical    | Row count suggests several years; oldest date not established                                                                            | Unknown    |

## 17. DGIPR

`https://dgipr.maharashtra.gov.in/notices` — Directorate General of Information and Public Relations.

| Property     | Finding                                                                                                                                                                       | Confidence |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `robots.txt` | Drupal default; `/notices` permitted                                                                                                                                          | Verified   |
| Listing      | 20 rows: date · subject · type (_Office order, Tender / Notice, Circular_) · PDF. Mostly internal orders; few procurement notices                                             | Verified   |
| PDFs         | Phone scans (`DocScanner 16 Jun 2026 16-49.pdf`) — image-only, need OCR                                                                                                       | Verified   |
| Role         | DGIPR's own procurement only; its EOI letters direct bidders to MahaTenders. DGIPR's wider role in releasing other departments' tender advertisements to newspapers is in §19 | Verified   |

## 18. Government PDF Repositories

| Repository                              | Pattern observed                                                     | Enumerable without a listing? | Notes                                                                           |
| --------------------------------------- | -------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| S3WaaS CDN (PWD and other S3WaaS sites) | `cdnbbsr.s3waas.gov.in/s3<hash>/uploads/<yyyy>/<mm>/<timestamp>.pdf` | No — timestamp file names     | Discover through the owning site's category pages; no `robots.txt`              |
| `maharashtra.gov.in`                    | `/Site/Upload/Pdf/…`, `/site/upload/WhatsNew/…`                      | No                            | `robots.txt`: `Allow: /`. GRs and reports, not tender notices, in what was seen |
| MSIDC (WordPress)                       | `/wp-content/uploads/<yyyy>/<mm>/…pdf`                               | Partly                        | Discover via `/tenders/` or sitemaps                                            |
| MHADA, MMRDA, DGIPR (Drupal)            | `/sites/default/files/[<yyyy-mm>/]…pdf`                              | No                            | Discover via listing pages                                                      |
| MEDA                                    | `/Site/Upload/pdf/…`                                                 | No                            | Discover via the listing                                                        |

**No repository was found that can be enumerated without its listing page.** Discovery is always through the publisher's own listing. The SHA-256 of the bytes is the only reliable document identity: file names are reused (`TenderNotice09.pdf`), and uploads can be replaced in place.

## 19. Newspaper / Public Notice Sources

- **Evidence that tender notices are advertised in newspapers:** MSEDCL invited bids _"to Appoint 4 Advertising Agencies to release Tender & other advertisements in Newspapers @ DGIPR/DAVP rates"_ (_Unverified_ — a search result on `mahadiscom.in`). GoM's _Digital Media Advertising Guidelines, 2023_ (`maharashtra.gov.in/Site/Upload/Pdf/Digital_Advertising_Guidelines_03_11_23.pdf`) governs government advertising through DGIPR (_Unverified_ — not opened).
- **Which tender classes must be advertised, and what an advertisement must contain,** was not established from a primary rule in this research (_Unknown_).
- **Assessment.** A newspaper is a third party's publication of an official notice. Useful for **discovery and corroboration** (a notice whose issuer page is missing); never the canonical record, which is the issuing agency's PDF. Newspaper archives are also commercially licensed. Not recommended for Phase 1.

## 20. data.gov.in

- `data.gov.in` serves `Disallow: /`; its **API** is a separate, documented channel and is permitted ([`../datagovin-api-findings.md`](../datagovin-api-findings.md)).
- **2026-08-25:** the catalogue (`api.data.gov.in/lists`, no key needed) held **no Maharashtra public-procurement dataset**. Five other states publish procurement data there (Assam, Andhra Pradesh, Punjab, Tamil Nadu, Jharkhand).
- **2026-09-30:** `api.data.gov.in` was **not reachable from either vantage point** (channel 1: no response; channel 2: tunnel failure). The August finding stands and was not re-confirmed.
- Recorded as: _Maharashtra public-procurement data was not identified in data.gov.in's catalogue as of 2026-08-25._

## 21. Search Engine Discovery

- **Useful:** `site:`-restricted searches found the PWD NIT service page, MSEDCL's separate e-tender portal, CIDCO's tender notice page and MSEDCL notice pages that the homepages did not link.
- **Consistent with `robots.txt`:** `site:mahapwd.gov.in` returned only the bare URL `http://mahapwd.gov.in/nit/` with no content — the disallowed host is not indexed.
- **Rule:** search engines are **discovery only** (§31). A result is followed to the official host, `robots.txt` is checked there, and only the official document is stored. A search result is never evidence.
- **Good uses:** bootstrapping a new agency's listing URL, discovering old notices whose listing page has rolled over, and watching for new publication surfaces.

## 22. Third-Party Sources

| Service (as found)                                        | Claims                                                          | Origin                                    | Confidence |
| --------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------- | ---------- |
| Parse.bot "Mahatenders.gov API"                           | Maharashtra listings, details and organisation browsing as JSON | States that it reads `mahatenders.gov.in` | Unverified |
| Apify "India Govt Tenders Scraper"                        | Active tenders from GePNIC portals including Maharashtra        | Describes itself as a scraper             | Unverified |
| Tenderbook "Tender Data API"                              | "2000+ government portals… State PWDs"                          | Not stated                                | Unverified |
| TenderX, IndianTenders, ContraVault (guides, aggregators) | Search and alerts                                               | Not stated                                | Unverified |

**Assessment.** A service that collects from `mahatenders.gov.in` does so from a host that has asked crawlers not to, and buying its output does not make that collection legitimate. Redistribution terms were not established for any of them. **Not a source.** At most a benchmark for measuring LokDarpan's own coverage, and only after legal review of each service's terms (§36).

## 23. Source Classification

| Tier | Definition                                 | Maharashtra members                                                                                                 | Use                                               |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1    | Primary official — the issuer's document   | Notice PDFs of MSIDC, MHADA, MMRDA, MSRDC, MEDA, DGIPR and CIDCO; PWD works lists and performance budgets           | **Ingestion; evidence**                           |
| 2    | Official derivative — the issuer's summary | Agency listing tables (MHADA, MSIDC, MMRDA archive, MSRDC); PWD NIT pages (permission needed)                       | **Metadata ingestion, verified against Tier 1**   |
| 3    | Official infrastructure                    | MahaTenders/GePNIC (link target and ID namespace only), the MSEDCL and MIDC e-tender systems, the `data.gov.in` API | Identifier cross-walk; enrichment where permitted |
| 4    | Secondary                                  | Commercial aggregators, newspapers                                                                                  | Benchmarking; gap detection                       |
| 5    | Discovery only                             | Search engines                                                                                                      | Finding Tier 1 and 2 URLs                         |

## 24. Source Comparison Matrix

**Field availability.** `A` Available · `P` Partially available · `N` Not available · `?` Unknown.

| Data                | PWD NIT¹ | MahaTenders² | Agency PDF (MSIDC) | Agency listing (MHADA) | PWD works list |
| ------------------- | :------: | :----------: | :----------------: | :--------------------: | :------------: |
| Tender ID (portal)  |    ?     |      A       |         N          |           P³           |       N        |
| Tender reference    |    ?     |      A       |         A          |           A            |       N        |
| Work title          |    A     |      A       |         A          |           A            |       A        |
| Department / board  |    A     |      A       |         A          |           A            |       A        |
| Division / office   |    A     |      A       |         A          |           P            |       P        |
| District            |    A⁴    |      P       |         P          |           N            |       A        |
| Estimated value     |    A     |      A       |         P          |           N            |       ?⁵       |
| EMD                 |    ?     |      A       |         P          |           N            |       N        |
| Tender fee          |    ?     |      A       |         P          |           N            |       N        |
| Publish date        |    ?     |      A       |         A          |           A            |       N        |
| Submission deadline |    A     |      A       |         A          |           A            |       N        |
| Opening date        |    ?     |      A       |         A          |           N            |       N        |
| Documents           |    A     |      A       |         A          |           A            |       —        |
| BOQ                 |    ?     |      P⁶      |         N          |           N            |       N        |
| Corrigendum         |    ?     |      A       |         ?          |           P            |       N        |
| Award information   |    ?⁷    |      N⁸      |         N          |           N            |       N        |
| Contractor          |    ?     |      N⁸      |         N          |           N            |       N        |
| Status              |    P     |      A       |         N          |           P            |       ?        |

¹ From one landing-page fetch; the host disallows crawling. ² The GePNIC platform generally; not collected in Maharashtra. ³ 2016-era rows. ⁴ District browsing exists; the per-notice district was not examined. ⁵ Numeric columns are unlabelled in the extracted text. ⁶ Registered bidders only. ⁷ A "Tenders Accepted" link, not examined. ⁸ CAPTCHA-gated.

**Source matrix:**

| Source           | Official |    CAPTCHA     | Auth |   Structured    | PDFs  |  Historical   |   Fresh   |        PWD        | Recommended                                       |
| ---------------- | :------: | :------------: | :--: | :-------------: | :---: | :-----------: | :-------: | :---------------: | ------------------------------------------------- |
| MahaTenders      |   Yes    | Search, awards | Bids |       Yes       |  Yes  |       ?       |   Daily   |        Yes        | **No** — `Disallow: /`; seek permission           |
| PWD NIT          |   Yes    |       No       |  No  |       Yes       |  Yes  |       ?       |   Daily   |      **Yes**      | **No** — `Disallow: /`; **seek permission first** |
| PWD documents    |   Yes    |       No       |  No  | No (PDF tables) |  Yes  |     2011→     |   Rare    |        Yes        | **Yes** — Work and Budget layer                   |
| MSIDC            |   Yes    |       No       |  No  |       Yes       |  Yes  |   Feb 2024→   | Irregular | **PWD programme** | **Yes — first**                                   |
| MMRDA            |   Yes    |       No       |  No  |   Archive yes   |  Yes  |   21 pages    |  Weekly   |        No         | Yes                                               |
| MHADA            |   Yes    |       No       |  No  |       Yes       |  Yes  | **Jul 2016→** |   Daily   |        No         | **Yes — first**                                   |
| MSEDCL           |   Yes    |   No (list)    | Bids |  Script-loaded  |   ?   |       ?       |   Daily   |        No         | Later; ask for a feed                             |
| MEDA             |   Yes    |  Script only   |  No  |     Partial     |  Yes  |       ?       | Irregular |        No         | Yes                                               |
| DGIPR            |   Yes    |       No       |  No  |   Yes (list)    | Scans |   2026 seen   |   Rare    |        No         | Low priority (OCR)                                |
| MSRDC            |   Yes    |       No       |  No  |       Yes       |   ?   |       ?       |  Weekly   |  State road PSU   | Yes                                               |
| data.gov.in      |   Yes    |       No       | Key  |       Yes       |  No   |       —       |     —     |    None found     | No Maharashtra dataset (Aug); recheck             |
| Newspapers       |    No    |       —        |  —   |       No        |   —   |   Archives    |   Daily   |       Some        | Discovery and corroboration only                  |
| Third-party APIs |    No    |       —        | Paid |       Yes       |   —   |       ?       |     ?     |         ?         | **No** — provenance and terms                     |

## 25. Data Coverage

| Source          | Current coverage                         | Historical       | Geographic      | Department            | Metadata completeness  | Document completeness      | Reliability                                  |
| --------------- | ---------------------------------------- | ---------------- | --------------- | --------------------- | ---------------------- | -------------------------- | -------------------------------------------- |
| MSIDC           | Its own notices                          | Feb 2024→        | State-wide      | MSIDC (PWD programme) | Medium; listing errors | High (every row has a PDF) | Unknown — requires crawl/backfill experiment |
| MHADA           | Its own notices, all boards              | Jul 2016→        | Board regions   | MHADA                 | High                   | High                       | Unknown — requires crawl/backfill experiment |
| MMRDA           | Current list script-loaded; archive HTML | 21 archive pages | MMR             | MMRDA                 | Medium                 | High                       | Unknown                                      |
| PWD works lists | Selected regions (6 files)               | Uploaded 2025-04 | Listed regions  | PWD                   | Unlabelled columns     | —                          | Unknown                                      |
| PWD NIT         | 35 notices / 85 works today              | Unknown          | All PWD regions | PWD                   | —                      | —                          | Not collectable                              |

**What share of Maharashtra's tenders these sources cover is unknown.** Measuring it needs a crawl/backfill experiment and a denominator LokDarpan does not have: MahaTenders' total is not collectable. No percentage is claimed.

## 26. Data Freshness

| Source        | Observed update rate                           | Recommended crawl                                        | Backfill                        |
| ------------- | ---------------------------------------------- | -------------------------------------------------------- | ------------------------------- |
| MHADA listing | Several notices a day                          | Daily: page 0 onward until a known row is met            | One-time, 455 pages, ≥2 s apart |
| MSIDC listing | Bursts, weeks apart                            | Daily fetch of the one page; diff by row                 | Already complete on one page    |
| MMRDA archive | Weekly                                         | Weekly, first two pages                                  | One-time, 21 pages              |
| MSRDC, MEDA   | Weekly                                         | Weekly                                                   | One-time                        |
| DGIPR         | Monthly                                        | Weekly                                                   | —                               |
| PWD documents | Rare (annual budgets; lists uploaded 2025-04)  | Monthly listing check; fetch only new or changed files   | One-time                        |
| Notice PDFs   | Fixed once published, but replaceable in place | Re-fetch only when the listing changes; hash every fetch | —                               |

The existing nightly tender collection runs at 20:00 UTC ([`../tender-collection-cadence.md`](../tender-collection-cadence.md)); Maharashtra agency sources join the same schedule, well below one request per second per host.

## 27. Tender Lifecycle

| Stage                         | Maharashtra official source found                                                                                                             | Confidence |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Planning / budget             | PWD performance budgets; BEAMS (collected, not published)                                                                                     | Verified   |
| Works identified              | PWD Roads & Bridges project lists                                                                                                             | Verified   |
| NIT                           | Agency notice PDFs (MSIDC, MHADA, MMRDA, MSRDC, MEDA); PWD NIT (permission needed)                                                            | Verified   |
| Tender published / corrigenda | Agency listings (MMRDA corrigenda); MahaTenders (not collected)                                                                               | Verified   |
| Bid submission / evaluation   | MahaTenders only (registered bidders)                                                                                                         | Verified   |
| **Award**                     | **Not identified in any collectable source as of 2026-09-30.** GePNIC awards are CAPTCHA-gated; PWD NIT's "Tenders Accepted" was not examined | —          |
| Agreement / work order        | Not identified in the sources reviewed                                                                                                        | —          |
| Execution / progress          | PMGSY OMMAS for rural roads (licence-blocked); not identified for PWD roads                                                                   | —          |
| Payment                       | BEAMS (aggregate, DDO level; permission pending)                                                                                              | Verified   |
| Completion                    | Not identified in the sources reviewed                                                                                                        | —          |
| Audit                         | CAG reports (held)                                                                                                                            | Verified   |

**The lifecycle matters more than the listing.** Collectable sources cover _planning → notice_ and _payment (aggregate) → audit_. **Award → agreement → execution** has no collectable Maharashtra source; that gap is where permission requests matter most.

## 28. Document Taxonomy

Extends the existing `document_type` enum (`audit_report`, `government_resolution`, `tender_notice`, `award_of_contract`, `work_order`, `completion_certificate`, `other`):

| Type                                   | Lifecycle stage | Seen in Maharashtra sources | Enum                                        |
| -------------------------------------- | --------------- | --------------------------- | ------------------------------------------- |
| `tender_notice` (NIT)                  | Notice          | All agencies                | Exists                                      |
| `corrigendum`                          | Notice          | MMRDA                       | **Add**                                     |
| `expression_of_interest`               | Pre-notice      | PWD NIT, MSIDC              | **Add**                                     |
| `auction_notice`                       | Disposal        | PWD NIT, MHADA e-auction    | **Add** — a sale, kept apart from purchases |
| `works_list`                           | Works           | PWD Roads & Bridges lists   | **Add**                                     |
| `performance_budget`                   | Budget          | PWD                         | **Add**                                     |
| `award_of_contract`                    | Award           | Not found                   | Exists                                      |
| `work_order`, `completion_certificate` | Execution       | Not found                   | Exist                                       |
| `boq`, `technical_specification`       | Notice          | Not found publicly          | Later                                       |
| `newspaper_notice`                     | Notice          | Not collected               | Later                                       |

## 29. Canonical Tender Identity

A notice may cover several works, a work may be re-tendered, and one tender may appear in several sources. Identity is established in this order:

1. **GePNIC tender ID** (`2016_MHADA_140945_1`) when a Tier-1 or Tier-2 source states it — unique on MahaTenders. Normalise Devanagari digits and separators before comparing.
2. **Issuer reference** (`MSIDC/Mumbai/Tender/55/2024`; `का.अ. (पश्चिम) / मुं.झो.सु.मंडळ/ई-निविदा/ १३४ / २०२६-२७`), scoped by issuer.
3. **Issuer + notice number + financial year** (`MSIDC · E-Tender Notice 09 · 2026-27`).
4. **Composite**: issuer + normalised work title + publication date + deadline.
5. **Document hash** (SHA-256) — identifies a document, never a tender.
6. **Fuzzy title matching** — produces a _candidate_ for review, never a merge ([ADR-068](../../adr/068-a-reviewer-decides-what-no-rule-can.md)).

**Collision risks.** Issuer references repeat across financial years; running numbers restart; reference numbers are shared by distinct tenders on GePNIC (which is why `tender.portal_tender_id`, not `tender_reference`, is today's identity); one notice lists many works. A work-level identity (road number + chainage + job number) belongs to the Work entity, not to the tender.

## 30. Deduplication

Every sighting is kept as an **observation**; the canonical tender is derived from them.

```text
MHADA listing row ─┐
MHADA notice PDF ──┼─► observations (one per source × fetch) ─► canonical tender (identity rules 1–4)
newspaper (later) ─┘                                              └─ each field cites the observation it came from
```

- Rules 1–3 match automatically; rule 4 matches automatically only when every component agrees exactly; anything weaker goes to review.
- A merge never deletes an observation. Conflicting values (the listing says 2023, the PDF says 2024) are both kept; the canonical field takes the Tier-1 value and records that a conflict exists.

## 31. Provenance — and Discovery Kept Apart From Authority

The repository already carries page-level provenance for documents: `document_fact(document_id, page_number, raw_text, normalised_value, extraction_method, parser_version, extraction_confidence, verification_status, verified_by, verified_at)` over `document` → `source_artifact(sha256, source_url, retrieved_at, stored_in)`. Tender notices should use **the same model**, not a parallel one:

```text
tender.closing_at = 2026-10-07 (IST)
  ← document_fact  (kind: deadline, page 1, raw_text "…07 October 2026…", parser mh-notice-v1, confidence 0.95)
  ← document       (doc_type tender_notice, issuing_authority "MHADA — Mumbai Slum Improvement Board")
  ← source_artifact (source_url https://www.mhada.gov.in/sites/default/files/TN_No_134-EE-West-MSIB-30-09-2026.pdf,
                     sha256 …, retrieved 2026-09-30, stored_in s3://lokdarpan-raw/…)

discovered_from:       https://www.mhada.gov.in/mr/tenders?page=0   (a listing: how we found it)
authoritative_source:  the PDF above                               (the evidence)
```

**Discovery and authority are separate fields.** A search engine, an aggregator or a listing can tell LokDarpan that a document exists; only the issuer's document is cited.

## 32. Geographic Resolution

| Evidence                                              | Where it appears                     | Resolves to                                   | Reliability                             |
| ----------------------------------------------------- | ------------------------------------ | --------------------------------------------- | --------------------------------------- |
| "Dist. Chandrapur", "Ta. Chimur"                      | MSIDC work names; PWD works lists    | District, taluka (LGD match)                  | High when stated                        |
| Road number + km chainage (`MDR-130, Km 0/00–12/000`) | MSIDC; PWD works lists               | A road segment — needs a road register to map | Medium; no road-geometry source yet     |
| Village names                                         | MSIDC, MHADA                         | LGD village (name match, often ambiguous)     | Low without a district                  |
| Division / board / office                             | PWD NIT, MHADA board, MMRDA division | An office, not a place                        | Low — ADR-067 `office_code` rules apply |
| PIN code                                              | Not seen in the notices read         | —                                             | —                                       |
| Coordinates                                           | Not seen                             | —                                             | —                                       |

**A district is recorded only when a document states it,** with `district_source` naming the evidence (ADR-067). An office is never silently turned into a district; unknown stays unknown.

## 33. Recommended Ingestion Architecture

Summary; detail and backlog in [`../../04-data-engineering/maharashtra-tender-ingestion.md`](../../04-data-engineering/maharashtra-tender-ingestion.md).

```text
 Agency listings (MHADA, MSIDC, MMRDA archive, MSRDC, MEDA, DGIPR)     PWD documents
              │  robots.txt checked · ≤1 request/s/host                   │
              ▼                                                           ▼
     Source adapter: discover → fetch (conditional, hashed) → R2 raw store + source_artifact
              ▼
     document (+ document_page) ← text extraction · glyph check · OCR when image-only
              ▼
     document_fact (dates, references, EMD, fee, value, place) — parser_version, confidence
              ▼
     tender_observation → canonical tender (+ tender_version history)
              ▼
     admin_unit placement (ADR-067/068) → API → site (details withheld per ADR-056)
```

No new infrastructure: PostgreSQL, R2 and the existing scheduled GitHub Actions job.

## 34. Source Adapter Architecture

One adapter per publisher, reusing `services/ingestion/src/net` (robots check, limits) and `raw-store.ts`:

```ts
interface GovernmentSourceAdapter {
  sourceId: string; // registry id, e.g. "mh-mhada-tenders"
  discover(since?: Date): Promise<DiscoveredArtifact[]>; // listing rows → document URLs
  fetch(artifact: DiscoveredArtifact): Promise<RawArtifact>; // conditional GET, SHA-256, R2
  parse(raw: RawArtifact): Promise<ParsedRecord[]>; // listing row or PDF → facts with page references
  normalize(record: ParsedRecord): Promise<NormalizedRecord>; // dates to IST, money to paise, digits to ASCII
  metadata(): SourceMetadata; // robots status, licence, cadence, contact
}
```

Adapters, in order: `MhadaTenderAdapter`, `MsidcTenderAdapter`, `MmrdaArchiveAdapter`, `MsrdcTenderAdapter`, `MedaTenderAdapter`, `PwdDocumentsAdapter`, `DgiprNoticeAdapter` (OCR). `MaharashtraPwdNitAdapter` only after written permission.

## 35. Failure Modes

| Failure                          | Behaviour                                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Source unreachable               | Retry with backoff (3×); record `last_checked_at` without `last_success_at`; other sources continue; the existing freshness alert fires |
| `robots.txt` changes to disallow | Stop that source on the next run; record the change; keep what was collected; flag for review                                           |
| Listing layout changes           | Parser yields zero rows → the run is marked failed, never "no tenders"                                                                  |
| PDF replaced at the same URL     | New SHA-256 → new `source_artifact` and `document`; the old one is kept; facts re-extracted                                             |
| PDF is a scan                    | OCR (`services/ocr`); pages counted in `pages_without_text`; low confidence until reviewed                                              |
| OCR fails / glyph substitution   | Document kept, facts not published, sent to review                                                                                      |
| Tender ID missing                | Identity rules 2–4; confidence recorded                                                                                                 |
| Listing and PDF disagree         | Both observations kept; the PDF wins; the conflict is flagged                                                                           |
| District missing                 | `unknown`; never inferred from an office name without ADR-067 evidence                                                                  |
| Contractor names differ          | Raw names kept; resolution produces candidates for review, never an automatic merge                                                     |

## 36. Security / Compliance / Operational Considerations

_Not legal advice. Items marked ⚖ need legal review._

| Topic                                             | Position                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots.txt`                                      | Honoured always. Two Maharashtra procurement hosts disallow all crawling: `mahatenders.gov.in` and `mahapwd.gov.in`                                                                                                                                                                                      |
| CAPTCHA / anti-bot                                | Never solved, bypassed or worked around                                                                                                                                                                                                                                                                  |
| Rate                                              | ≤1 request per second per host, sequential, with an identifying user agent and contact URL; backfills spread over days                                                                                                                                                                                   |
| Authentication                                    | No credentials are used on any source                                                                                                                                                                                                                                                                    |
| **Technically accessible ≠ safe to redistribute** | A notice may be collected as evidence and still not be republishable. ⚖ The terms of use of each agency site (MHADA, MSIDC, MMRDA…) were **not** reviewed in this research. Until they are: store and link; display only what LokDarpan has permission to show (the ADR-056 precedent for GePNIC detail) |
| Government Open Data Licence                      | Covers data published on `data.gov.in`. ⚖ Whether it covers agency websites was not established                                                                                                                                                                                                          |
| Attribution                                       | Every displayed fact names the issuing agency, the document and the retrieval date                                                                                                                                                                                                                       |
| Storage                                           | Raw files kept in R2 (private bucket) for re-parsing; not served publicly                                                                                                                                                                                                                                |
| Third-party data                                  | ⚖ Terms not reviewed; not used                                                                                                                                                                                                                                                                           |

## 37. Rejected Approaches

| Approach                                              | Why rejected                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CAPTCHA solving (human or paid service)               | Defeats an access control the publisher chose; taints the provenance of every record |
| CAPTCHA OCR                                           | The same, automated                                                                  |
| Bypass through endpoints found in network traffic     | An undocumented endpoint behind a gated page is still behind the gate                |
| Credential sharing                                    | Bidder accounts are for bidding; using them to collect breaches their terms          |
| Ignoring `robots.txt` (MahaTenders, `mahapwd.gov.in`) | The publisher has asked; the repository's rule is to honour it always                |
| Aggressive scraping                                   | Government hosts are small; load is a harm, and a block ends the source              |
| Depending on one website                              | Maharashtra already shows why: one policy closed MahaTenders                         |
| Depending on a third-party aggregator                 | Unknown and probably disallowed provenance; unknown redistribution rights; lock-in   |
| Search engine as the database                         | The index is partial and unstable, and it is not evidence                            |

## 38. Recommended Approach

### Final Recommendation

#### What we should do

1. **Ingest agency-published tender notices** from hosts that permit it, as documents with page-level facts, on the existing raw-store and document pipeline — starting with **MHADA** (deepest archive, best structure) and **MSIDC** (PWD-programme works).
2. **Ingest PWD's own documents** — Roads & Bridges project lists and performance budgets — as the Work and Budget layers the tenders will join to.
3. **Ask PWD in writing for permission to collect `mahapwd.gov.in/nit/`**, and send the already-drafted MahaTenders request. PWD is one department with a narrower system than NIC; its answer is the most valuable one outstanding.
4. **Store GePNIC tender IDs whenever a notice states them,** and link to MahaTenders — never fetch it.

#### What we should not do

Solve, bypass or route around any CAPTCHA; crawl `mahatenders.gov.in` or `mahapwd.gov.in`; use bidder credentials; buy third-party scraped data; treat search results or newspapers as the record.

#### Primary sources

Tier-1 agency notice PDFs of MHADA, MSIDC, MMRDA, MSRDC and MEDA; PWD works lists and budgets.

#### Secondary sources

Tier-2 agency listing tables, verified against their PDFs; MSEDCL and MIDC once a documented or permitted interface is confirmed.

#### Discovery sources

`site:`-restricted search on official domains; sitemaps where published (MSIDC, MEDA, CIDCO, Maha Metro).

#### First implementation

Phases A–D of the backlog: MHADA and MSIDC adapters into R2, `document` and `document_fact`; a `tender_observation` link to the canonical `tender`; and the permission letter to PWD.

#### Future expansion

MMRDA, MSRDC, MEDA, DGIPR (OCR), CIDCO, MIDC, Maha Metro, MJP, WRD and the municipal corporations; PWD NIT if permitted; MahaTenders if permitted; other states on the same adapter contract.

#### Remaining unknowns

The share of Maharashtra tenders these sources cover; the PWD works-list column meanings; the PWD NIT detail-page fields and its "Tenders Accepted" contents; each agency's terms of use; the current `data.gov.in` catalogue; whether any agency publishes awards.

### How this serves the larger platform

The same adapter, raw-store, document and observation model that ingests a MHADA notice will ingest a CAG report, a budget book, a works list or an award notice. Each new publisher is an adapter, not a new pipeline, and every figure keeps its document and page. No single website — MahaTenders included — can then remove LokDarpan's view of Maharashtra procurement by changing one policy.

## 39. Implementation Plan

Each phase has backlog items in the architecture document.

| Phase | Scope                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------- |
| A     | Registry and permissions: add sources with evidence; send the PWD NIT and MahaTenders requests |
| B     | MHADA and MSIDC listing adapters; notice PDFs into R2 and `document`                           |
| C     | Notice parser → `document_fact`; normalisation (IST, paise, Devanagari digits)                 |
| D     | `tender_observation` and canonical tender identity; provenance to the page                     |
| E     | Deduplication and review queue                                                                 |
| F     | Historical backfill (MHADA 2016→, MSIDC 2024→, MMRDA archive)                                  |
| G     | Freshness: nightly incremental runs, change detection, alerting                                |
| H     | Further agencies; PWD works lists and budgets                                                  |
| I     | PWD NIT and MahaTenders enrichment — only on written permission                                |

## 40. Open Questions

1. Will PWD permit automated collection from `mahapwd.gov.in/nit/`, and at what rate? (Ask.)
2. Do agency site terms permit republishing notice facts, or only linking? (⚖)
3. Is the MHADA 2016-era reference exactly the MahaTenders tender ID? (Confirm with MHADA, or from a permitted source.)
4. What are the numeric columns of PWD's Roads & Bridges lists? (Read a page image; ask PWD.)
5. Does any Maharashtra agency publish award or work-order documents? (None found.)
6. What share of MahaTenders' Maharashtra tenders do agency pages cover? (Needs a permitted denominator.)
7. Does MSEDCL publish a documented feed for its e-tender lists?

## 41. Sources / References

All checked 2026-09-30 on channel 1 unless noted.

| Name                             | URL                                                                                                                            | Type                   | Result                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------- |
| MahaTenders `robots.txt`         | `https://mahatenders.gov.in/robots.txt`                                                                                        | Policy                 | 200 · `Disallow: /`                     |
| PWD homepage                     | `https://pwd.maharashtra.gov.in/`                                                                                              | Official site          | 200                                     |
| PWD NIT service                  | `https://pwd.maharashtra.gov.in/en/service/notice-inviting-tender/`                                                            | Official page          | 200 (found by channel-2 search)         |
| PWD NIT system                   | `http://mahapwd.gov.in/nit/default.asp`                                                                                        | Official system        | 200 over HTTP; **`Disallow: /`**        |
| PWD NIT `robots.txt`             | `http://mahapwd.gov.in/robots.txt`                                                                                             | Policy                 | 200 · `Disallow: /`                     |
| PWD Roads & Bridges lists        | `https://pwd.maharashtra.gov.in/document-category/रस्ते-आणि-पूल/`                                                              | Official documents     | 200                                     |
| PWD budgets                      | `https://pwd.maharashtra.gov.in/document-category/अर्थसंकल्प/`                                                                 | Official documents     | 200                                     |
| MSIDC tenders                    | `https://msidc.org/tenders/`                                                                                                   | Official listing       | 200                                     |
| MHADA tenders                    | `https://www.mhada.gov.in/mr/tenders` (`?page=0…454`)                                                                          | Official listing       | 200                                     |
| MMRDA archive                    | `https://mmrda.maharashtra.gov.in/mr/tenders/tender-notices/archive`                                                           | Official listing       | 200                                     |
| MSEDCL e-tender                  | `https://etender.mahadiscom.in/eatApp/latestTendersWorks`                                                                      | Official system        | 200 (found by channel-2 search)         |
| MEDA tenders                     | `https://mahaurja.maharashtra.gov.in/Site/1607/Tenders-EoI-Offers`                                                             | Official listing       | 200                                     |
| DGIPR notices                    | `https://dgipr.maharashtra.gov.in/notices`                                                                                     | Official listing       | 200                                     |
| MSRDC tenders                    | `https://msrdc.in/site/common/TenderView.aspx`                                                                                 | Official listing       | 200                                     |
| MIDC tender list                 | `https://wms1.midcindia.org/vendorportal/midcportal/tenderlist.aspx?isexternalProject=1`                                       | Official system (form) | 200                                     |
| CIDCO tender notices             | `https://cidco.maharashtra.gov.in/Page?Token=DE0E063C112`                                                                      | Official listing       | 200 (found by channel-2 search)         |
| e-Governance report, 2013        | `https://maharashtra.gov.in/site/upload/WhatsNew/State%20of%20E-Governance%20in%20Maharashtra%20,%202013.pdf`                  | Official report        | 200 · p. 66 thresholds                  |
| CPPP downloads (GePNIC material) | `https://eprocure.gov.in/eprocure/app?page=StandardBiddingDocuments&service=page`                                              | NIC                    | 200                                     |
| `data.gov.in` API                | `https://api.data.gov.in/lists`                                                                                                | Official API           | Not reachable from either vantage point |
| Prior findings                   | [`../gepnic-access-findings.md`](../gepnic-access-findings.md), [`../datagovin-api-findings.md`](../datagovin-api-findings.md) | Repository             | 2026-08-25                              |
