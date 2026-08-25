# LGD — the hierarchy is collectable; the bulk download is not

**Date:** 2026-08-25 · **Host:** `lgdirectory.gov.in` · **Status:** PRODUCTION_READY for States/UTs · below that, blocked on a NAPIX API key

Established while starting Sprint 1. The registry recorded LGD as VERIFIED but had never established **how the data is actually obtained** — which, after [`gepnic-access-findings.md`](./gepnic-access-findings.md), is a separate question from whether a site responds.

## `robots.txt`

**None served.** `/robots.txt` returns a Struts error page, not a robots file. No stated crawl restriction.

## Three routes, only two usable

| Route                                       | Verdict            | Detail                                                                                                                                                                                 |
| ------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizen views** (`globalview*.do`)        | **Usable**         | No CAPTCHA in the form. Requires a session cookie and a per-session `OWASP_CSRFTOKEN`, both obtained from the home page. Returns the full listing as an HTML table                     |
| **NAPIX API** (`dev.napix.gov.in/nic/lgd/`) | **Live, untested** | An official API developer portal. The sanctioned-channel route, and preferable to parsing HTML if it serves the same data — worth evaluating before the village-level ingest           |
| ~~**`downloadDirectory.do`**~~              | **CAPTCHA-gated**  | Offers exactly what is wanted — All States / Districts / Sub-Districts / Villages of India — but `captchaAnswer` is a field **inside the download form**. Not usable, and not bypassed |

**The citizen views only get as far as States/UTs.** `globalviewdistrictforcitizen.do` is a form, not a listing: it posts to `globalviewdistrict.do` with `paramStateCode` **and `captchaAnswer`**. The district level and everything beneath it is behind a CAPTCHA on this route.

That is a finding, not an obstacle to work around. NAPIX is the route below state level.

---

## NAPIX — the sanctioned route for the rest of the hierarchy

`https://dev.napix.gov.in/nic/lgd/` is the National API Exchange developer portal for LGD. Documentation is readable without an account; calling an API requires a key obtained by self-service registration.

It publishes the hierarchy as REST products:

| Product                  | Path            |
| ------------------------ | --------------- |
| `STATE 1.0.0`            | `/product/427`  |
| `DISTRICT 1.0.0`         | `/product/430`  |
| `SUBDISTRICT 1.0.0`      | `/product/1514` |
| `BLOCK 1.0.0`            | `/product/403`  |
| `LOCALBODY 1.0.0`        | `/product/1061` |
| `CANTONMENT BOARD 1.0.0` | `/product/406`  |
| `CONSTITUENCY 1.0.0`     | `/product/1085` |
| `LGD 1.0.0`              | `/product/1735` |

The `DISTRICT` product documents `districtsByState` and **`districtsByStateByDuration`** — the latter takes `updatedFrom`/`updatedTo`, which makes **incremental sync** possible rather than re-fetching the whole hierarchy. That matters at village scale (677,367 rows) and is not available from the HTML views at all.

### Why this supersedes HTML parsing below state level

1. It is what the publisher built for programmatic access. Parsing a citizen-facing HTML view is a workaround; using the documented API is the intended path.
2. It carries no CAPTCHA.
3. Incremental sync by update date removes the need to re-retrieve unchanged data.
4. A JSON contract is far less brittle than table-column positions.

The State/UT connector already built against the citizen view stays useful — it works today, needs no key, and its parser tests encode two source properties (the local-name column and NFC normalisation) that will apply to the API responses too.

### Blocked on

**A NAPIX API key.** Registration is self-service at `/nic/lgd/user/register` and asks for account details, not a description of what is being built. Until a key exists, ingestion below State/UT level cannot proceed by any route this project is willing to use.

## What the State/UT listing contains

`globalviewstateforcitizen.do` returns 36 rows and 7 data columns: serial, **State LGD Code**, **Name (In English)**, **Name (In Local language)**, **State or UT**, Census 2001 code, Census 2011 code.

### Two properties that would corrupt the data if missed

**1. The local-language column is mostly not a local-language name.** Only **7 of 36** states carry a genuine local-script name. The other 29 repeat the English name in upper case — `ASSAM`, `BIHAR`, `PUNJAB`. Storing those as a local name would make the app render `PUNJAB` as though it were Marathi.

They are recorded as **not published (`NULL`)**. Missing is missing — the same rule that forbids rendering a missing figure as zero.

The seven that do publish one span five scripts: Tripura (Bengali), Jharkhand and Chhattisgarh and Maharashtra (Devanagari), Odisha (Odia), Karnataka (Kannada), Telangana (Telugu).

**2. LGD emits some Indic text decomposed.** Chhattisgarh's `ढ़` arrives as `ढ` + nukta (U+0922 U+093C), not the precomposed U+095D. The two are visually identical and compare unequal, so a user searching the state's name would silently miss it. **All extracted text is normalised to NFC at ingest.**

## An artefact-store consequence worth knowing

The CSRF token is embedded in the returned HTML, so **two fetches of identical data produce different bytes and therefore different content addresses**. The raw store accumulates one artefact per retrieval rather than one per distinct dataset.

For an append-only audit store that is defensible — each artefact is a faithful record of one retrieval. It is noted here because the storage-growth assumption for the village-level ingest (677,367 rows, fetched per state) should account for it, and because a "logical" content hash computed after stripping volatile tokens may be worth adding then.

## Standing-rule checklist

- [x] `robots.txt` fetched — none served, no restriction stated
- [x] Whether an official API exists — **yes, NAPIX**, evaluated 25 Aug and adopted as the route below state level
- [x] CAPTCHA presence noted — on `downloadDirectory.do` **and on the district view**, never bypassed
- [x] Identifiable user agent; collection is scheduled, never user-triggered
- [ ] Terms of use located and read
- [ ] **Licence captured** — still outstanding, and required before display
