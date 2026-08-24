# Administrative Hierarchy Sources

> `.docs/03-domain/administrative-hierarchy.md` requires a canonical hierarchy from India down to ward. This file records the sources for it.

Verified 21 August 2026.

## Primary source: Local Government Directory (LGD)

**`https://lgdirectory.gov.in/`** — ✅ VERIFIED (via alternate network channel; not reachable from the sandbox egress).

Ministry of Panchayati Raj, with the Office of the Registrar General of India. Its stated purpose is to maintain an up-to-date standard location directory of every administrative unit and local body, and to assign each a unique code enabling interoperability across e-governance applications.

### Coverage observed

| Level                           | Count                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------- |
| States / UTs                    | 36                                                                              |
| Districts                       | 784                                                                             |
| Sub-districts (taluka / tehsil) | 7,092                                                                           |
| Development blocks              | 7,323                                                                           |
| **Villages**                    | **677,367** (657,989 inhabited · 18,373 uninhabited · 1,005 forest)             |
| Parliamentary constituencies    | 543                                                                             |
| Assembly constituencies         | 4,116                                                                           |
| Local bodies                    | Rural panchayats, urban municipalities, traditional councils, cantonment boards |
| Wards                           | Mapped to urban and rural local bodies                                          |

### Capabilities

- Search by name or LGD code
- **58+ reports** on hierarchies and mappings
- **Downloads by state/district**
- Ward → local-body mappings
- **Historical modification tracking with government-order documentation**
- **NAPIX API** for registered applications (registration-gated)

### Mapping to `.docs/05-data-model/database-design.md`

```text
LGD                          .docs/05-data-model/database-design.md admin_unit
────────────────────────────────────────────────
State/UT                  →  level='state'
District                  →  level='district'      lgd_code
Sub-district              →  level='taluka'        lgd_code
Block                     →  level='block'         lgd_code
Village                   →  level='village'       lgd_code, census_code
Panchayat (rural LB)      →  level='gram_panchayat'  pri_code
Municipality (urban LB)   →  level='municipality'…   ulb_code
Ward                      →  level='ward'
Modification history      →  valid_from / valid_to
```

`.docs/05-data-model/database-design.md`'s schema anticipated this correctly. **LGD can populate it directly, including the boundary-versioning columns.**

## Secondary sources

| Source           | Role                                                          | Status                                                                                                              |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **IGOD** ✅      | Organisation directory, including 870 district-portal entries | ✅ crawled — see [`.docs/06-government-sources/igod-organization-catalogue.csv`](./igod-organization-catalogue.csv) |
| Census of India  | Census codes, historical demographic joins                    | 🔍 `censusindia.gov.in` timed out from this vantage point                                                           |
| data.gov.in ✅   | Publishes an **LGD catalogue**                                | ✅ verified                                                                                                         |
| State portals ✅ | State-specific administrative codes                           | catalogued, not verified individually                                                                               |

## Two discrepancies to resolve

1. **District counts disagree between official directories.** LGD reports 784 districts; IGOD's crawl yielded 870 district entries. Both are Government of India directories. Neither has been reconciled. LGD should be treated as authoritative for _administrative_ units; IGOD's entries are _portals_, and the surplus likely reflects police commissionerates, sub-divisions and multiple portals per district — **but that is a hypothesis, not a verified explanation.**

2. **Districts change.** The crawl surfaced Ahilyanagar (formerly Ahmednagar) and Chhatrapati Sambhajinagar (formerly Aurangabad) — both Maharashtra districts renamed recently, still on their old domains (`ahmednagar.nic.in`, `aurangabad.gov.in`). LGD's modification tracking with government-order references is the correct source of truth for this, and `.docs/05-data-model/database-design.md`'s `valid_from`/`valid_to` columns are the correct place to store it.

## Geographic hierarchy

Boundary geometry is **not** in LGD. See [`.docs/06-government-sources/gis/gis-portals.md`](./gis/gis-portals.md).
