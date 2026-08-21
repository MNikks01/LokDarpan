# Union Territory Sources

> All 8 Union Territories. Note that Dadra & Nagar Haveli and Daman & Diu merged in 2020 but retain two operational procurement portals.
>
> Verified 21 August 2026. Every URL was fetched; none written from memory.

## Coverage

Every State and UT was crawled from the Integrated Government Online Directory (§4). **No State/UT is omitted.**

The complete catalogue — organisation name, official URL, IGOD category, and state — is machine-readable at [`igod-organization-catalogue.csv`](./igod-organization-catalogue.csv) (6,466 rows). These are **`DISCOVERED`**: they came from an official directory but were not individually fetched. Only the sources promoted into [`source-registry.json`](./source-registry.json) carry `VERIFIED` status.

| UT | Orgs in IGOD | Departments | Districts | Boards/PSUs | Schemes/Apps | e-Procurement portal | Status |
|---|---:|---:|---:|---:|---:|---|---|
| **Andaman and Nicobar Islands** | 51 | 23 | 7 | 0 | 0 | `https://eprocure.gov.in/epublish/app` | ✅ |
| **Chandigarh** | 82 | 30 | 0 | 8 | 0 | `https://etenders.chd.nic.in` | ✅ |
| **Dadra and Nagar Haveli and Daman and Diu** | 47 | 35 | 7 | 0 | 0 | `https://dnhtenders.gov.in` | ✅ |
| **Delhi** | 252 | 48 | 14 | 29 | 12 | `https://govtprocurement.delhi.gov.in` | ✅ |
| **Jammu and Kashmir** | 170 | 40 | 24 | 16 | 12 | `https://jktenders.gov.in` | ✅ |
| **Ladakh** | 44 | 37 | 0 | 0 | 0 | `https://tenders.ladakh.gov.in/` | ✅ |
| **Lakshadweep** | 22 | 9 | 0 | 0 | 0 | `https://tendersutl.gov.in` | ✅ |
| **Puducherry** | 79 | 44 | 0 | 6 | 8 | `https://pudutenders.gov.in` | ✅ |

## What each State/UT inventory contains

IGOD classifies every State/UT organisation into these categories, all captured in the catalogue CSV:

`Departments` · `Directorates / Commissionerates` · `Attached / Subordinated Offices` · `Boards / Undertakings` · `PSUs / JVs / Companies / Societies` · `Statutory / Autonomous Bodies` · `Commissions / Committees` · `Academies / Institutions` · `Districts` · `Schemes / Programmes / Missions / Applications` · `Others`

The `Departments`, `Districts` and `Schemes / Programmes / Missions / Applications` categories are the ones that matter most for LokDarpan: they contain the PWD/finance/treasury/rural-development departments, the district portals, and the state MIS applications (budget systems, works systems, scheme dashboards).

## Method and its limits

Discovery used IGOD as the authoritative directory (§4), supplemented by domain-restricted search for specific functional systems. **What this does not yet give us:**

- Per-state finance/treasury/PWD portals have been *catalogued* but only Maharashtra's have been *verified* — see [`phase-1-maharashtra-roads.md`](./phase-1-maharashtra-roads.md).
- IGOD's own coverage is uneven: Lakshadweep has 22 organisations listed, Gujarat 386. A low count means **fewer entries in the directory**, not fewer government bodies.
- Districts: IGOD lists 870 district entries nationally against LGD's authoritative count of **784 districts**. The two directories disagree, and neither has been reconciled to the other. See [`administrative-hierarchy-sources.md`](./administrative-hierarchy-sources.md).
