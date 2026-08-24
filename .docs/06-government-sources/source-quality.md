# Source Quality & Verification Model

Verified 21 August 2026.

## The three states (§31)

No source is called complete before we know what it exposes and how to get it.

| State                  | Meaning                                                                                                                                | Count                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **`DISCOVERED`**       | Found in an official directory or domain-restricted search. URL may or may not have been fetched. Nothing known about its data.        | **6,466** catalogue rows + 3 registry entries |
| **`VERIFIED`**         | URL fetched; HTTP status, final URL and page title recorded. Confirms the source **exists and responds** — not what it contains.       | **96** registry entries                       |
| **`PRODUCTION_READY`** | Data exposure, retrieval method, identifiers, update cadence, history, extraction method, legal position and entity mapping all known. | **0**                                         |

**Zero sources are `PRODUCTION_READY`, and that is the honest state after a discovery pass.** Promotion requires field-level inspection, which is the next phase.

## Machine-accessibility grade (§21)

This grades **extraction difficulty, not truthfulness**. An `E` source is exactly as authoritative as an `A` source.

| Grade | Definition                                 | Examples identified                                                                 |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| **A** | Official structured API                    | data.gov.in ✅ · LGD NAPIX (registration-gated) ✅                                  |
| **B** | Official downloadable structured data      | LGD state/district downloads ✅ · NDAP ✅ · eSankhyiki ✅                           |
| **C** | Official HTML / database-backed pages      | CPPP ✅ · 36 State/UT procurement portals ✅ · IGOD ✅                              |
| **D** | Official PDF                               | India Budget ✅ · CAG reports ✅ · MoRTH ✅ · CGA ✅                                |
| **E** | Official scanned PDF requiring OCR         | Expected in state budget and local-body documents — **none confirmed in this pass** |
| **F** | Official dashboard with limited extraction | GeM ✅ · PFMS 🔍                                                                    |

Current distribution across the 99 registry entries is heavily **C and D** — HTML portals and PDF documents. This matches `.docs/04-data-engineering/data-collection-architecture.md`'s assumption that PDF/OCR and scraping are core pipeline capabilities, and confirms that an API-first ingestion design would serve almost none of the real sources.

## Accessibility classification (§20)

| Class                   | Where observed                                                 |
| ----------------------- | -------------------------------------------------------------- |
| `PUBLIC_API`            | data.gov.in                                                    |
| `PUBLIC_DOWNLOAD`       | LGD, NDAP, eSankhyiki                                          |
| `PUBLIC_WEB_PAGE`       | CPPP, all State/UT procurement portals, IGOD, department sites |
| `PUBLIC_DOCUMENT`       | India Budget, CAG, CGA, MoRTH, state finance departments       |
| `PUBLIC_DASHBOARD`      | Not separately confirmed                                       |
| `CAPTCHA`               | **Not assessed for any source**                                |
| `LOGIN_REQUIRED`        | GeM (partial), PFMS (partial), state IFMS (partial)            |
| `PARTIAL_PUBLIC_ACCESS` | GeM, PFMS                                                      |
| `NOT_MACHINE_READABLE`  | Not separately confirmed                                       |
| `UNKNOWN`               | Majority of field-level questions                              |

**CAPTCHA presence was not tested on any portal.** GePNIC deployments commonly present one on search; this must be established per portal, and per §24 **no CAPTCHA or access control may be bypassed**. Where one blocks automated access, the source is either ingested through an official download/API route or not ingested.

## Verification method

Two independent network channels were used, and the distinction turned out to matter:

1. **Sandbox HTTP** — direct `GET`, following redirects, recording status, final URL, page title, content type.
2. **Alternate egress fetch** — used to re-test failures.

A set of `.gov.in` / `.nic.in` hosts resolved in DNS but refused or timed out from channel 1. `lgdirectory.gov.in` was among them and **succeeded on channel 2** — proving the pattern is a vantage-point restriction, not site failure.

**Therefore every unreachable host in this registry is recorded as _"not reachable from the verification vantage point on 21 Aug 2026; existence not disproven"_, never as unavailable** (§35).

Hosts affected: `finmin.gov.in`, `doe.gov.in`, `rural.nic.in`, `pmgsy.nic.in`, `omms.nic.in`, `online.omms.nic.in`, `egramswaraj.gov.in`, `amrut.gov.in`, `smartcities.gov.in`, `pmayurban.gov.in`, `pmayg.nic.in`, `censusindia.gov.in`, `nrida.nic.in`.

**These must be re-verified from an Indian network before ingestion planning.** Several are high-value.

## Re-verification cadence

URL decay is measurable here: **7 of 36 entries in the government's own published procurement list were dead** (see [`.docs/06-government-sources/procurement/procurement-portals.md`](./procurement/procurement-portals.md)). A registry built once and trusted will rot.

| Check                                                | Frequency                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Link health across the registry                      | Weekly (matches `.docs/02-architecture/system-architecture.md`'s weekly link-health cron) |
| Page-title drift (detects silent portal replacement) | Weekly                                                                                    |
| Re-crawl of IGOD                                     | Quarterly                                                                                 |
| Re-parse of the CPPP State/UT list                   | Quarterly                                                                                 |
| Field-level re-assessment                            | On drift alert                                                                            |
