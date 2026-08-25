# `data.gov.in` API — catalogue is open, Maharashtra procurement is absent

**Date:** 2026-08-25 · **Host:** `api.data.gov.in` · **Related:** [`gepnic-access-findings.md`](./gepnic-access-findings.md), [`access-and-permissions.md`](./access-and-permissions.md)

## Why this was investigated

`data.gov.in` serves `Disallow: /`, so its HTML is not scraped. Its **documented API is a separate, sanctioned channel** — the publisher built it for programmatic access — and [`access-and-permissions.md`](./access-and-permissions.md) §"`robots.txt` governs crawling, not sanctioned APIs" permits its use on exactly that basis.

After [`gepnic-access-findings.md`](./gepnic-access-findings.md) established that award data is CAPTCHA-gated across every GePNIC deployment and CPPP, this was the last untested route to procurement data.

---

## Access model

| Endpoint                 | API key          | Result                                                                         |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------ |
| `/lists` (catalogue)     | **Not required** | `status: ok`, **285,974 resources**, pagination via `offset` confirmed working |
| `/resource/{index_name}` | **Required**     | `{"error": "Authorization field missing"}`                                     |

Discovery is therefore free and complete; retrieving records needs a key. Keys are issued by self-service registration.

## Query syntax — and a failure mode worth recording

**Working:** `filters[title]=`, `filters[org]=`, `filters[desc]=`

**Silently ignored:** `q=`, `search=`, `keyword=`, `title=`, `sector=`

The ignored parameters **do not error**. They return the full unfiltered 285,974-record set, so a query using them looks like a search that ran and matched broadly. An early attempt here concluded "no tender datasets exist" on exactly this basis; the search had never executed.

> **For the connector:** confirm a filter took effect by checking that `total` changed from the unfiltered count. Do not infer absence from an unchanged `total`.

---

## Maharashtra: no public-procurement data published

`filters[org]=Maharashtra` returns **50 datasets**, all of them city-level civic indicators — air quality (Nagpur, Pune), disease and health series (Pimpri Chinchwad, Thane, Nashik), road condition (Pune), property tax (Nagpur), solid waste, street lights, land use.

**No tenders, contracts, works, or departmental expenditure appear among them.**

The single result matching both "Maharashtra" and "procurement" is `Year-wise details of procurement centres opened in Maharashtra` — published by **Rajya Sabha**, concerning **agricultural** procurement centres, last updated 2019. It is not public-procurement data.

Recorded per the registry rule as: **public-procurement data for Maharashtra was not identified in `data.gov.in`'s catalogue as of 2026-08-25.** Not as "Maharashtra does not publish it".

**Consequence:** this closes the last route to Maharashtra procurement data that required no correspondence, and independently confirms the Phase-1 decision recorded in [`gepnic-access-findings.md`](./gepnic-access-findings.md) — keep Maharashtra, ship without procurement.

---

## Six states do publish procurement data here

Scanning all 242 procurement-titled datasets by publisher:

| State          | Datasets | Note                                                                                                                                                  |
| -------------- | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Assam**      |    **6** | `Assam Public Procurement Data`, **2016-17 → 2021-22**, consecutive. Finance Department, Assam / Assam Society for Comprehensive Financial Management |
| Andhra Pradesh |        4 |                                                                                                                                                       |
| Punjab         |        2 |                                                                                                                                                       |
| Tamil Nadu     |        2 |                                                                                                                                                       |
| Jharkhand      |        1 |                                                                                                                                                       |

**This is the only non-CAPTCHA route to procurement data identified in the review so far.** Every GePNIC portal gates award data behind interactive verification; these finance departments published to an open API instead.

### What is not yet known

Field-level contents. Whether the Assam series carries contractor, award value and department — or only aggregate counts — cannot be determined without a key. **Unknown, not absent.**

### Why this does not reopen the Phase-1 decision

- The Assam series **ends at 2021-22** — four years stale at time of writing.
- Its fields are unverified.
- Maharashtra's BEAMS is current, monthly, and reaches DDO level across ten years ([`sprint0-findings-q1-q3.md`](./sprint0-findings-q1-q3.md)).

Its value is as a **template** for what the procurement layer should contain, and as a candidate second state after Phase 1 ships.

---

## Next step

Obtain a `data.gov.in` API key by self-service registration, then inspect the Assam series field-by-field. That determines whether a state-published procurement dataset can carry the tender → contractor → award link at all, which is the open question behind Branch A.
