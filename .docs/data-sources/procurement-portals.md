# Procurement & Tender Portals

> Every official government procurement system identified, Central and State/UT. This is the single most important source category for LokDarpan (`docs/00` tender→contractor→release chain).
>
> **Verification date:** 21 August 2026 · **Status model:** `DISCOVERED` → `VERIFIED` → `PRODUCTION_READY` (see [`source-quality.md`](./source-quality.md)).
> No URL in this file was written from memory; every one was discovered from an official directory or a domain-restricted search and then fetched.

## Central procurement systems

| Source | URL | Status | HTTP | Page title (as fetched) |
|---|---|---|---|---|
| **Central Public Procurement Portal (CPPP)** | `https://eprocure.gov.in/cppp/` | ✅ VERIFIED | 200 | Central Public Procurement Portal | Home en | GeM-CPPP | Tenders Portal of Government of India | Government eTenders |
| **Central Public Procurement ePublishing System** | `https://eprocure.gov.in/epublish/app` | ✅ VERIFIED | 200 | ePublishing System, Government of India |
| **Government e Marketplace (GeM)** | `https://gem.gov.in/` | ✅ VERIFIED | 200 | Government e Marketplace | National Public Procurement Portal |
| **Government eProcurement System (etenders.gov.in / GePNIC central instance)** | `https://etenders.gov.in/eprocure/app` | ✅ VERIFIED | 200 | Government eProcurement System |
| **eProcurement System for PMGSY** | `https://pmgsytenders.gov.in` | ✅ VERIFIED | 200 | eProcurement System for Pradhan Mantri Gram Sadak Yojana (PMGSY) |

### CPPP public endpoints observed

Fetched from `https://eprocure.gov.in/cppp/` on 21 August 2026. These are the extraction surfaces that matter:

| Endpoint | Carries |
|---|---|
| `/cppp/latestactivetendersnew` | Active tenders |
| `/cppp/resultoftendersnew` | **Tender results** |
| `/cppp/awards` | **Awards** |
| `/cppp/cancelledtenders` | Cancelled tenders |
| `/cppp/debarredbidderlist` | **Debarred bidder list** |
| `/cppp/debarmentlistsearch` | Debarment search |
| `/cppp/highvaluetenders` | High-value tenders |
| `/cppp/globaltenders` · `/cppp/gemtender` | Global / GeM tenders |

Awards, results and debarment are published surfaces. **Whether the award record names the winning contractor and the awarded amount in machine-extractable form was not field-verified in this pass** and is the first thing to check in the next phase.

### GePNIC standard pages

Most State/UT portals are NIC **GePNIC** deployments sharing one page structure (observed on the Goa, Madhya Pradesh, PMGSY and central instances):

```text
/nicgep/app?page=FrontEndTendersByOrganisation&service=page
/nicgep/app?page=FrontEndTendersByClassification&service=page
/nicgep/app?page=FrontEndListTendersbyDate&service=page
/nicgep/app?page=WebTenderStatusLists&service=page
/nicgep/app?page=StandardBiddingDocuments&service=page
```

This is a significant engineering result: **one connector can serve most States/UTs**, with per-state exceptions. See [`ingestion-methods.md`](./ingestion-methods.md).

## State / UT procurement portals

`Platform` distinguishes GePNIC deployments from state-specific systems — §8's explicit warning not to assume they are identical.

| State / UT | Portal | Status | HTTP | Platform |
|---|---|---|---|---|
| Andaman and Nicobar Islands | `https://eprocure.gov.in/epublish/app` | ✅ VERIFIED | 200 | CPPP ePublishing only |
| Andhra Pradesh | `https://apeprocurement.gov.in/` | ✅ VERIFIED | 200 | state-specific |
| Arunachal Pradesh | `https://arunachaltenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Assam | `https://assamtenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Bihar | `https://eproc2.bihar.gov.in` | ✅ VERIFIED | 200 | state-specific |
| Chandigarh | `https://etenders.chd.nic.in` | ✅ VERIFIED | 200 | GePNIC |
| Chhattisgarh | `https://eproc.cgstate.gov.in` | ✅ VERIFIED | 200 | state-specific (CHiPS) |
| Dadra and Nagar Haveli and Daman and Diu | `https://dnhtenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Delhi | `https://govtprocurement.delhi.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Goa | `https://eprocure.goa.gov.in/` | ✅ VERIFIED | 200 | GePNIC |
| Gujarat | `https://tender.nprocure.com` | ✅ VERIFIED | 200 | state-specific (nProcure / (n)Code, via GIL) |
| Haryana | `https://etenders.hry.nic.in` | ✅ VERIFIED | 200 | GePNIC |
| Himachal Pradesh | `https://hptenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Jammu and Kashmir | `https://jktenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Jharkhand | `https://jharkhandtenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Karnataka | `https://eproc.karnataka.gov.in` | ✅ VERIFIED | 200 | state-specific |
| Kerala | `https://etenders.kerala.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Ladakh | `https://tenders.ladakh.gov.in/` | ✅ VERIFIED | 200 | GePNIC |
| Lakshadweep | `https://tendersutl.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Madhya Pradesh | `https://mptenders.gov.in/nicgep/app` | ✅ VERIFIED | 200 | GePNIC |
| Maharashtra | `https://mahatenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Maharashtra | `https://mahatenders.gov.in` | ✅ VERIFIED | 200 | None |
| Manipur | `https://manipurtenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Meghalaya | `https://meghalayatenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Mizoram | `https://mizoramtenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Nagaland | `https://nagalandtenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Odisha | `https://www.tendersodisha.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Puducherry | `https://pudutenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Punjab | `https://eproc.punjab.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Rajasthan | `https://eproc.rajasthan.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Sikkim | `https://sikkimtender.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Tamil Nadu | `https://tntenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Telangana | `https://eprocurement.telangana.gov.in/` | ✅ VERIFIED | 200 | state-specific |
| Tripura | `https://tripuratenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| Uttar Pradesh | `https://etender.up.nic.in` | ✅ VERIFIED | 200 | GePNIC |
| Uttarakhand | `https://uktenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |
| West Bengal | `https://wbtenders.gov.in` | ✅ VERIFIED | 200 | GePNIC |

### Additional / secondary official procurement surfaces

| State / UT | Source | URL | Status |
|---|---|---|---|
| Andhra Pradesh | AP eProcurement — tender search | `https://tender.apeprocurement.gov.in` | ✅ VERIFIED |
| Assam | State Public Procurement Portal of Assam | `https://sppp.assam.gov.in` | ✅ VERIFIED |
| Gujarat | Gujarat Informatics Ltd — eProcurement (state nodal agency) | `https://gil.gujarat.gov.in/eprocurement` | ✅ VERIFIED |
| Kerala | Local Self Government Department Kerala — tenders | `https://tender.lsgkerala.gov.in` | ✅ VERIFIED |
| Rajasthan | Rajasthan State Public Procurement Portal | `https://sppp.rajasthan.gov.in` | ✅ VERIFIED |

## Stale entries in the government's own published list

The official CPPP list (`eprocure.gov.in/mmp/sites/default/files/eproc/States_eProc_relatedlinks.pdf`, parsed 21 Aug 2026) is the authoritative starting point — **and seven of its entries no longer resolve.** Cross-referencing it against IGOD and domain-restricted search was necessary to obtain a working portal for every State/UT.

| State / UT | URL in the official CPPP list | Result | Working portal found instead |
|---|---|---|---|
| Andhra Pradesh | `http://www.eprocurement.gov.in/` | timed out | `https://apeprocurement.gov.in/` ✅ |
| Bihar | `https://www.eproc.bihar.gov.in` | DNS failure | `https://eproc2.bihar.gov.in` ✅ |
| Chhattisgarh | `https://cgeprocurement.gov.in` | DNS failure | `https://eproc.cgstate.gov.in` ✅ |
| Goa | `http://www.etender.goa.gov.in` | timed out | `https://eprocure.goa.gov.in/` ✅ |
| Gujarat | `https://www.nprocure.com/asp/...` | TLS failure | `https://tender.nprocure.com` ✅ |
| Punjab | `http://eprocpbpwd.gov.in` | DNS failure | `https://eproc.punjab.gov.in` ✅ |
| Punjab (2nd listed) | `https://etender.punjabgovt.gov.in` | timed out | as above |

Two further problems with the list, both recorded rather than corrected:

- **Ladakh is absent entirely.** The UT was created in 2019. Its portal (`https://tenders.ladakh.gov.in/`, ✅ verified) was found via domain-restricted search.
- **Dadra & Nagar Haveli and Daman & Diu are listed as two separate UTs** with two portals (`dnhtenders.gov.in`, `ddtenders.gov.in` — both ✅ still live). They merged into one UT in 2020. Both portals remain operational, which is a genuine two-source situation for one UT, not an error to normalise away.

**Consequence for ingestion:** the source registry cannot be seeded from any single government list. It needs at least two independent official directories plus live verification, and it needs periodic re-verification because these URLs decay.

## Non-GePNIC states

| State | System | Note |
|---|---|---|
| Gujarat | nProcure, via Gujarat Informatics Ltd (state PSU) | Runs on `tender.nprocure.com` — a **`.com` domain operated by a state-appointed nodal agency**. Treated as official because GIL (`gil.gujarat.gov.in`, ✅) is a Government of Gujarat undertaking designated for this purpose. Flagged for legal review before ingestion. |
| Andhra Pradesh | State-specific | `apeprocurement.gov.in` ✅ |
| Telangana | State-specific | `eprocurement.telangana.gov.in` ✅ |
| Karnataka | State-specific | `eproc.karnataka.gov.in` ✅ (returned an empty `<title>`) |
| Bihar | State-specific | `eproc2.bihar.gov.in` → `/EPSV2Web/` ✅ |
| Chhattisgarh | CHiPS | `eproc.cgstate.gov.in` ✅ |
| Assam, Rajasthan | Additional State Public Procurement Portals | `sppp.assam.gov.in` ✅, `sppp.rajasthan.gov.in` ✅ — separate from the GePNIC/eProc instance |

## What was NOT determined

Per §35, these are open questions, not negative findings:

- Which fields each portal exposes publicly (§9's tender-identity / financial / timeline / outcome / document field lists) — **not field-verified for any portal**.
- Whether awarded contractor name and awarded value are extractable per tender.
- CAPTCHA and login requirements per portal.
- Historical/archived tender availability and depth.
- Whether any portal offers an API or bulk download.
