# Maharashtra Tender Sources — Inventory

**Last verified:** 2026-09-30 · Research and reasoning: [`maharashtra-tender-data.md`](./maharashtra-tender-data.md) · Architecture: [`../../04-data-engineering/maharashtra-tender-ingestion.md`](../../04-data-engineering/maharashtra-tender-ingestion.md)

One entry per source. **Confidence** follows the research document: _Verified_ (fetched and inspected on 2026-09-30), _Likely_, _Unverified_ (search result or third-party description only), _Unknown_. `robots.txt` was read before any page on every host. A host that did not answer is _not reachable from the verification vantage point on the date given; existence not disproven_.

**Usage key.** **Ingest** — collect and parse as evidence. **Ingest later** — collectable, lower priority. **Permission first** — the host asks crawlers not to collect; ask in writing. **Link only** — store identifiers and link, never fetch. **Discovery** — use to find official URLs only. **Do not use.**

---

## Summary

| #   | Source                            | Robots permits tender pages | CAPTCHA on list | Historical       | Usage                        |
| --- | --------------------------------- | :-------------------------: | :-------------: | ---------------- | ---------------------------- |
| 1   | MahaTenders (GePNIC)              |   **No** (`Disallow: /`)    | Search, awards  | Unknown          | **Link only**; permission    |
| 2   | PWD NIT (`mahapwd.gov.in/nit/`)   |   **No** (`Disallow: /`)    |       No        | Unknown          | **Permission first**         |
| 3   | PWD website — documents           |             Yes             |       No        | 2011→ (budgets)  | **Ingest**                   |
| 4   | MSIDC                             |             Yes             |       No        | Feb 2024→        | **Ingest — first**           |
| 5   | MHADA                             |             Yes             |       No        | Jul 2016→        | **Ingest — first**           |
| 6   | MMRDA                             |             Yes             |       No        | 21 archive pages | Ingest                       |
| 7   | MSRDC                             |             Yes             |       No        | Unknown          | Ingest                       |
| 8   | MEDA / Mahaurja                   |             Yes             |   Script only   | Unknown          | Ingest                       |
| 9   | DGIPR                             |             Yes             |       No        | 2026 seen        | Ingest later (OCR)           |
| 10  | MSEDCL e-tender                   |    Yes (no `robots.txt`)    |       No        | Unknown          | Ingest later; ask for a feed |
| 11  | MIDC                              |    Yes (no `robots.txt`)    |       No        | Unknown          | Ingest later                 |
| 12  | CIDCO                             |             Yes             |       No        | 2022→ (sparse)   | Ingest later                 |
| 13  | Maha Metro (Nagpur, Pune)         |          See entry          |     Unknown     | Unknown          | Not yet examined             |
| 14  | MJP, WRD, MSRTC, MMB, MCGM        |   No `robots.txt` served    |     Unknown     | Unknown          | Not yet examined             |
| 15  | `data.gov.in` API                 |        API permitted        |       No        | —                | Recheck                      |
| 16  | CPPP (`eprocure.gov.in`)          |       No `robots.txt`       | Search, awards  | —                | Not a Maharashtra source     |
| 17  | Newspapers / DGIPR advertisements |              —              |        —        | Archives         | Discovery                    |
| 18  | Search engines                    |              —              |        —        | —                | Discovery                    |
| 19  | Third-party tender APIs           |              —              |        —        | —                | **Do not use**               |

---

## 1. MahaTenders

| Field                   | Value                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source                  | eProcurement System, Government of Maharashtra (GePNIC)                                                                                                                                                                    |
| Official URL            | `https://mahatenders.gov.in/nicgep/app`                                                                                                                                                                                    |
| Tender URL              | Same; listings by organisation, location and recency                                                                                                                                                                       |
| Agency                  | NIC's GePNIC platform, used by GoM departments and undertakings                                                                                                                                                            |
| Source type             | Tier 3 — official infrastructure                                                                                                                                                                                           |
| Current availability    | Live (linked from PWD, MMRDA, MSRDC)                                                                                                                                                                                       |
| Historical availability | Unknown                                                                                                                                                                                                                    |
| CAPTCHA                 | Search, full lists and award results (platform-wide finding, 2026-08-25)                                                                                                                                                   |
| Authentication          | Bidder registration for documents and bids                                                                                                                                                                                 |
| Structured data         | Yes (HTML)                                                                                                                                                                                                                 |
| PDF                     | Yes, to registered bidders                                                                                                                                                                                                 |
| Archive                 | Unknown                                                                                                                                                                                                                    |
| Fields                  | Tender ID, reference, organisation chain, title, value, EMD, fee, dates, documents, status (platform)                                                                                                                      |
| Freshness               | Continuous                                                                                                                                                                                                                 |
| **robots.txt**          | **`User-agent: * / Disallow: /`** — Verified 2026-09-30 ([evidence](../evidence-mahatenders-robots.txt))                                                                                                                   |
| Recommended usage       | **Link only.** Store GePNIC tender IDs found in agency notices; link to the portal; never fetch. Written permission drafted ([`../mahatenders-access-request-draft.md`](../mahatenders-access-request-draft.md)), not sent |
| Last verified           | 2026-09-30                                                                                                                                                                                                                 |
| Notes                   | No publicly documented official API was found during this research                                                                                                                                                         |

## 2. PWD NIT system

| Field                   | Value                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Source                  | Notice Inviting Tenders, Public Works Department (legacy system)                                                             |
| Official URL            | `http://mahapwd.gov.in/` (HTTP; the HTTPS certificate chain is incomplete)                                                   |
| Tender URL              | `http://mahapwd.gov.in/nit/default.asp`, linked from `https://pwd.maharashtra.gov.in/en/service/notice-inviting-tender/`     |
| Agency                  | Public Works Department, Government of Maharashtra                                                                           |
| Source type             | Tier 2 — official derivative (the department's listing of its e-tenders)                                                     |
| Current availability    | Live, HTTP 200; "Online Tenders Notices: 35, Number of Works: 85" on 2026-09-30                                              |
| Historical availability | Unknown                                                                                                                      |
| CAPTCHA                 | None on the landing page                                                                                                     |
| Authentication          | None on the landing page                                                                                                     |
| Structured data         | Server-rendered ASP; detail pages `/nit/Tender.asp?nitno=<integer>`; browse by region (10) and district (36); search by date |
| PDF                     | Under `/Nit/…` (rate notices, auctions and EOIs seen as links)                                                               |
| Archive                 | Unknown; a "Tenders Accepted" page exists                                                                                    |
| Fields                  | Seen on the landing page: name of work, office/division, estimated cost                                                      |
| Freshness               | Current notices listed daily                                                                                                 |
| **robots.txt**          | **`User-agent: * / Disallow: /`** — Verified 2026-09-30 ([evidence](../evidence-mahapwd-robots.txt))                         |
| Recommended usage       | **Permission first.** The highest-value request: PWD-scoped, browsable by division and district, CAPTCHA-free                |
| Last verified           | 2026-09-30                                                                                                                   |
| Notes                   | One landing-page fetch was made before `robots.txt` was read; nothing further was fetched                                    |

## 3. PWD website — documents

| Field                    | Value                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source                   | Public Works Department, Government of Maharashtra                                                                                                                 |
| Official URL             | `https://pwd.maharashtra.gov.in/` (English under `/en/`)                                                                                                           |
| Tender URL               | None on this site; the homepage sends tenders to MahaTenders and the NIT service to `mahapwd.gov.in`                                                               |
| Document URLs            | `/document-category/रस्ते-आणि-पूल/` (Roads & Bridges project lists), `/document-category/अर्थसंकल्प/` (Performance Budgets 2021-22→2024-25; budget books 2011-12→) |
| Agency                   | PWD                                                                                                                                                                |
| Source type              | Tier 1 — primary official documents (Work and Budget stages)                                                                                                       |
| Current availability     | Live                                                                                                                                                               |
| Historical availability  | Budgets from 2011-12; works lists uploaded 2025-04                                                                                                                 |
| CAPTCHA / Authentication | None / None                                                                                                                                                        |
| Structured data          | Listing pages (title, date, file); tables inside PDFs                                                                                                              |
| PDF                      | Yes, on `cdnbbsr.s3waas.gov.in` (2–10 MB). The works list uses a legacy Devanagari font (glyph substitution)                                                       |
| Fields                   | Works list: region, code, road class, work description with district, taluka, road number and chainage, CRIF job number, five numeric columns (meaning Unknown)    |
| Freshness                | Rare                                                                                                                                                               |
| robots.txt               | `pwd.maharashtra.gov.in`: `Disallow: /wp-admin/` only. `cdnbbsr.s3waas.gov.in`: none (404)                                                                         |
| Recommended usage        | **Ingest** as Work and Budget documents                                                                                                                            |
| Last verified            | 2026-09-30                                                                                                                                                         |

## 4. MSIDC

| Field                    | Value                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Source                   | Maharashtra State Infrastructure Development Corporation Ltd                                                              |
| Official URL             | `https://msidc.org/`                                                                                                      |
| Tender URL               | `https://msidc.org/tenders/` — titled "E-Tenders for Maharashtra PWD Projects"                                            |
| Agency                   | GoM undertaking executing PWD-programme works                                                                             |
| Source type              | Tier 1 (PDFs) and Tier 2 (listing)                                                                                        |
| Current availability     | Live; 290 rows                                                                                                            |
| Historical availability  | 26 Feb 2024 → 6 Jul 2026                                                                                                  |
| CAPTCHA / Authentication | None / None                                                                                                               |
| Structured data          | One HTML table: Sr. No, Publication Date, Last Date/Time of Submission, Name of Work, PDF                                 |
| PDF                      | `msidc.org/wp-content/uploads/<yyyy>/<mm>/…pdf`, born-digital                                                             |
| Archive                  | The single page holds every row                                                                                           |
| Fields (PDF)             | Notice number, office reference, issue / pre-bid / submission / opening dates, fee, EMD, eligibility, MahaTenders pointer |
| Freshness                | Irregular bursts                                                                                                          |
| robots.txt               | `/wp-admin/` only; sitemaps published                                                                                     |
| Recommended usage        | **Ingest — first** (PWD-programme works)                                                                                  |
| Last verified            | 2026-09-30                                                                                                                |
| Notes                    | Listing dates contain errors (deadline years before publication); trust the PDF                                           |

## 5. MHADA

| Field                    | Value                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Source                   | Maharashtra Housing and Area Development Authority                                                                                     |
| Official URL             | `https://www.mhada.gov.in/`                                                                                                            |
| Tender URL               | `https://www.mhada.gov.in/mr/tenders` (`?page=0…454`)                                                                                  |
| Agency                   | MHADA and its regional boards                                                                                                          |
| Source type              | Tier 1 (PDFs) and Tier 2 (listing)                                                                                                     |
| Current availability     | Live; notices dated 29–30 Sep 2026                                                                                                     |
| Historical availability  | **25 July 2016 →**, about 4,547 rows                                                                                                   |
| CAPTCHA / Authentication | None / None                                                                                                                            |
| Structured data          | HTML table: e-publication date, notice number, reference / tender no., board, document description, closing date, PDF; filter by board |
| PDF                      | `/sites/default/files/TN_No_<n>-<office>-<dd-mm-yyyy>.pdf`                                                                             |
| Archive                  | The paginated listing is the archive                                                                                                   |
| Fields                   | As above; 2016 references follow the GePNIC tender-ID pattern (`२०१६-म्हाडा-१४०९४५-१`)                                                 |
| Freshness                | Daily                                                                                                                                  |
| robots.txt               | Drupal default; tender pages permitted                                                                                                 |
| Recommended usage        | **Ingest — first** (deepest archive, best structure, GePNIC ID cross-walk)                                                             |
| Last verified            | 2026-09-30                                                                                                                             |
| Notes                    | The separate e-auction portal `eauction.mhada.gov.in` was not examined                                                                 |

## 6. MMRDA

| Field                    | Value                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Source                   | Mumbai Metropolitan Region Development Authority                                                                      |
| Official URL             | `https://mmrda.maharashtra.gov.in/`                                                                                   |
| Tender URL               | Current: `/mr/tenders/tender-notices` (script-rendered). Archive: `/mr/tenders/tender-notices/archive` (`?page=0…20`) |
| Source type              | Tier 1 / Tier 2                                                                                                       |
| Current availability     | Live                                                                                                                  |
| Historical availability  | 21 archive pages                                                                                                      |
| CAPTCHA / Authentication | None / None                                                                                                           |
| Structured data          | Archive table: tender reference (often blank), division, type (Tender / Notice), title, issue date, end date, PDF     |
| PDF                      | `/sites/default/files/<yyyy-mm>/…pdf`, including corrigenda                                                           |
| Freshness                | Weekly                                                                                                                |
| robots.txt               | Drupal default; tender pages permitted                                                                                |
| Recommended usage        | **Ingest** (archive HTML)                                                                                             |
| Last verified            | 2026-09-30                                                                                                            |

## 7. MSRDC

| Field                    | Value                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Source                   | Maharashtra State Road Development Corporation                                                |
| Official URL             | `https://msrdc.in/`                                                                           |
| Tender URL               | `https://msrdc.in/site/common/TenderView.aspx`                                                |
| Source type              | Tier 2 (listing)                                                                              |
| CAPTCHA / Authentication | None / None                                                                                   |
| Structured data          | Table: department, tender no. (`T 2943`), tender name, publication date, last submission date |
| PDF                      | Not on the listing page; detail not examined                                                  |
| Historical availability  | Unknown                                                                                       |
| robots.txt               | `Allow: /`                                                                                    |
| Recommended usage        | **Ingest**                                                                                    |
| Last verified            | 2026-09-30                                                                                    |

## 8. MEDA / Mahaurja

| Field                   | Value                                                                           |
| ----------------------- | ------------------------------------------------------------------------------- |
| Source                  | Maharashtra Energy Development Agency                                           |
| Official URL            | `https://mahaurja.maharashtra.gov.in/` (`www.mahaurja.com` redirects)           |
| Tender URL              | `https://mahaurja.maharashtra.gov.in/Site/1607/Tenders-EoI-Offers`              |
| Source type             | Tier 1 / Tier 2                                                                 |
| CAPTCHA                 | reCAPTCHA script loaded site-wide; the tender table renders without interaction |
| Structured data         | About 760 rows: particulars, notice and quotation PDFs                          |
| PDF                     | `/Site/Upload/pdf/…`                                                            |
| Historical availability | Unknown                                                                         |
| robots.txt              | Disallows `/search`, `/admin`                                                   |
| Recommended usage       | **Ingest**                                                                      |
| Last verified           | 2026-09-30                                                                      |

## 9. DGIPR

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| Source            | Directorate General of Information and Public Relations                     |
| Tender URL        | `https://dgipr.maharashtra.gov.in/notices`                                  |
| Source type       | Tier 1                                                                      |
| Structured data   | 20 rows: date, subject, type (office order / tender-notice / circular), PDF |
| PDF               | Image scans — OCR needed                                                    |
| robots.txt        | Drupal default; `/notices` permitted                                        |
| Recommended usage | **Ingest later** (few procurement notices; OCR cost)                        |
| Last verified     | 2026-09-30                                                                  |

## 10. MSEDCL e-tender

| Field             | Value                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source            | Maharashtra State Electricity Distribution Co. Ltd                                                                                                      |
| Official URL      | `https://www.mahadiscom.in/`                                                                                                                            |
| Tender URL        | `https://etender.mahadiscom.in/eatApp/latestTendersWorks` (its own system, not GePNIC)                                                                  |
| Source type       | Tier 3 (own e-tender system); notice posts on the main site are Tier 1                                                                                  |
| CAPTCHA           | None on the list page                                                                                                                                   |
| Structured data   | Server HTML carries column headers only (Tender No, Description, Purchase From/To, Technical Bid Open, Submission Due, Tender Fee); rows load by script |
| robots.txt        | `etender.mahadiscom.in`: none (404). `www.mahadiscom.in`: empty `Disallow:`                                                                             |
| Recommended usage | **Ingest later.** Ask MSEDCL for a documented feed; do not reverse-engineer the list's data endpoint                                                    |
| Last verified     | 2026-09-30                                                                                                                                              |

## 11. MIDC

| Field             | Value                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Source            | Maharashtra Industrial Development Corporation                                                                   |
| Official URL      | `https://midc.maharashtra.gov.in/` (`www.midcindia.org` redirects)                                               |
| Tender URL        | `https://wms1.midcindia.org/vendorportal/midcportal/tenderlist.aspx?isexternalProject=1` (zone + work-type form) |
| robots.txt        | `midc.maharashtra.gov.in`: WordPress admin paths only. `wms1.midcindia.org`: none served                         |
| Recommended usage | **Ingest later**, after confirming the form is a public listing                                                  |
| Last verified     | 2026-09-30                                                                                                       |

## 12. CIDCO

| Field             | Value                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Source            | City and Industrial Development Corporation of Maharashtra                                                       |
| Tender URL        | `https://cidco.maharashtra.gov.in/Page?Token=DE0E063C112` ("Tender Notices")                                     |
| Structured data   | 18 rows: date, name, description, PDF (2022–2025)                                                                |
| robots.txt        | Disallows `/login`, `/search`, `/*?q=`; sitemap published                                                        |
| Recommended usage | **Ingest later** (sparse; a separate e-tender route mentioned on its contractor-registration page is unexamined) |
| Last verified     | 2026-09-30                                                                                                       |

## 13–14. Discovered, not yet examined

| Source                                  | URL discovered                                                                       | robots.txt on 2026-09-30                    |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| Maha Metro — Nagpur                     | `https://www.metrorailnagpur.com/nagpur-metro-tenders` (linked from `mahametro.org`) | HTML returned, not a `robots.txt`           |
| Maha Metro — Pune                       | `https://punemetrorail.org/tenders` (linked from `mahametro.org`)                    | Present; rules for `*` not recorded         |
| Maha Metro (corporate)                  | `https://www.mahametro.org/`                                                         | `Disallow:` empty for `*`; `/cgi-bin/` only |
| Maharashtra Jeevan Pradhikaran          | `https://mjp.maharashtra.gov.in/`                                                    | None (404)                                  |
| Water Resources Department              | `https://wrd.maharashtra.gov.in/`                                                    | None (404)                                  |
| MSRTC                                   | `https://msrtc.maharashtra.gov.in/`                                                  | None (404)                                  |
| Maharashtra Maritime Board              | `https://mahammb.maharashtra.gov.in/`                                                | None (single-page app returned)             |
| Municipal Corporation of Greater Mumbai | `https://portal.mcgm.gov.in/`                                                        | None (404)                                  |

## 15. `data.gov.in` API

`https://api.data.gov.in/lists` — catalogue, no key needed. **2026-08-25:** no Maharashtra public-procurement dataset ([`../datagovin-api-findings.md`](../datagovin-api-findings.md)). **2026-09-30:** not reachable from either vantage point. Usage: **recheck**.

## 16. CPPP

`https://eprocure.gov.in/cppp/` — no `robots.txt`; search and Bid Awards are CAPTCHA-gated; no bulk export (2026-08-25). Its downloads page lists GePNIC material (brochure, model tender documents). Usage: not a source of Maharashtra state tenders.

## 17. Newspapers / DGIPR advertising

Tender advertisements are released to newspapers at DGIPR/DAVP rates (Unverified). Usage: **discovery and corroboration only**; never canonical.

## 18. Search engines

Usage: **discovery only**. `site:mahapwd.gov.in` returns only a bare URL, consistent with its `robots.txt`.

## 19. Third-party tender APIs

Parse.bot "Mahatenders.gov API", Apify "India Govt Tenders Scraper", Tenderbook "Tender Data API" and similar (Unverified). Usage: **do not use.** They describe collecting from `mahatenders.gov.in`, which disallows crawling, and their terms and redistribution rights were not reviewed.
