# State Government Sources

> All 28 States, catalogued from the Integrated Government Online Directory and verified where promoted to the registry.
>
> Verified 21 August 2026. Every URL was fetched; none written from memory.

## Coverage

Every State and UT was crawled from the Integrated Government Online Directory (§4). **No State/UT is omitted.**

The complete catalogue — organisation name, official URL, IGOD category, and state — is machine-readable at [`.docs/06-government-sources/igod-organization-catalogue.csv`](../igod-organization-catalogue.csv) (6,466 rows). These are **`DISCOVERED`**: they came from an official directory but were not individually fetched. Only the sources promoted into [`.docs/06-government-sources/source-registry.json`](../source-registry.json) carry `VERIFIED` status.

| State | Orgs in IGOD | Departments | Districts | Boards/PSUs | Schemes/Apps | e-Procurement portal | Status |
|---|---:|---:|---:|---:|---:|---|---|
| **Andhra Pradesh** | 239 | 36 | 30 | 42 | 18 | `https://apeprocurement.gov.in/` | ✅ |
| **Arunachal Pradesh** | 121 | 34 | 25 | 7 | 19 | `https://arunachaltenders.gov.in` | ✅ |
| **Assam** | 279 | 54 | 38 | 36 | 17 | `https://assamtenders.gov.in` | ✅ |
| **Bihar** | 235 | 43 | 42 | 24 | 36 | `https://eproc2.bihar.gov.in` | ✅ |
| **Chhattisgarh** | 163 | 36 | 33 | 19 | 11 | `https://eproc.cgstate.gov.in` | ✅ |
| **Goa** | 118 | 49 | 6 | 14 | 0 | `https://eprocure.goa.gov.in/` | ✅ |
| **Gujarat** | 386 | 32 | 37 | 62 | 22 | `https://tender.nprocure.com` | ✅ |
| **Haryana** | 224 | 49 | 26 | 24 | 11 | `https://etenders.hry.nic.in` | ✅ |
| **Himachal Pradesh** | 159 | 38 | 16 | 28 | 8 | `https://hptenders.gov.in` | ✅ |
| **Jharkhand** | 125 | 29 | 28 | 13 | 20 | `https://jharkhandtenders.gov.in` | ✅ |
| **Karnataka** | 192 | 50 | 35 | 25 | 16 | `https://eproc.karnataka.gov.in` | ✅ |
| **Kerala** | 318 | 56 | 18 | 46 | 22 | `https://etenders.kerala.gov.in` | ✅ |
| **Madhya Pradesh** | 269 | 54 | 57 | 34 | 19 | `https://mptenders.gov.in/nicgep/app` | ✅ |
| **Maharashtra** | 301 | 45 | 40 | 43 | 22 | `https://mahatenders.gov.in` | ✅ |
| **Manipur** | 111 | 37 | 18 | 8 | 10 | `https://manipurtenders.gov.in` | ✅ |
| **Meghalaya** | 148 | 47 | 15 | 9 | 10 | `https://meghalayatenders.gov.in` | ✅ |
| **Mizoram** | 100 | 49 | 12 | 0 | 0 | `https://mizoramtenders.gov.in` | ✅ |
| **Nagaland** | 66 | 29 | 19 | 0 | 0 | `https://nagalandtenders.gov.in` | ✅ |
| **Odisha** | 269 | 47 | 34 | 41 | 16 | `https://www.tendersodisha.gov.in` | ✅ |
| **Punjab** | 175 | 39 | 27 | 20 | 14 | `https://eproc.punjab.gov.in` | ✅ |
| **Rajasthan** | 223 | 62 | 44 | 24 | 19 | `https://eproc.rajasthan.gov.in` | ✅ |
| **Sikkim** | 52 | 26 | 6 | 0 | 0 | `https://sikkimtender.gov.in` | ✅ |
| **Tamil Nadu** | 257 | 46 | 41 | 50 | 11 | `https://tntenders.gov.in` | ✅ |
| **Telangana** | 209 | 40 | 37 | 17 | 17 | `https://eprocurement.telangana.gov.in/` | ✅ |
| **Tripura** | 131 | 32 | 12 | 13 | 0 | `https://tripuratenders.gov.in` | ✅ |
| **Uttar Pradesh** | 303 | 54 | 79 | 25 | 26 | `https://etender.up.nic.in` | ✅ |
| **Uttarakhand** | 201 | 48 | 17 | 23 | 12 | `https://uktenders.gov.in` | ✅ |
| **West Bengal** | 239 | 55 | 26 | 22 | 11 | `https://wbtenders.gov.in` | ✅ |

## What each State/UT inventory contains

IGOD classifies every State/UT organisation into these categories, all captured in the catalogue CSV:

`Departments` · `Directorates / Commissionerates` · `Attached / Subordinated Offices` · `Boards / Undertakings` · `PSUs / JVs / Companies / Societies` · `Statutory / Autonomous Bodies` · `Commissions / Committees` · `Academies / Institutions` · `Districts` · `Schemes / Programmes / Missions / Applications` · `Others`

The `Departments`, `Districts` and `Schemes / Programmes / Missions / Applications` categories are the ones that matter most for LokDarpan: they contain the PWD/finance/treasury/rural-development departments, the district portals, and the state MIS applications (budget systems, works systems, scheme dashboards).

## Method and its limits

Discovery used IGOD as the authoritative directory (§4), supplemented by domain-restricted search for specific functional systems. **What this does not yet give us:**

- Per-state finance/treasury/PWD portals have been *catalogued* but only Maharashtra's have been *verified* — see [`.docs/06-government-sources/phase-1-maharashtra-roads.md`](../phase-1-maharashtra-roads.md).
- IGOD's own coverage is uneven: Lakshadweep has 22 organisations listed, Gujarat 386. A low count means **fewer entries in the directory**, not fewer government bodies.
- Districts: IGOD lists 870 district entries nationally against LGD's authoritative count of **784 districts**. The two directories disagree, and neither has been reconciled to the other. See [`.docs/06-government-sources/administrative-hierarchy-sources.md`](../administrative-hierarchy-sources.md).
