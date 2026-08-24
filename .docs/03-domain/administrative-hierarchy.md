# 19 — Administrative Hierarchy & Local Bodies

The platform models the **complete Indian administrative and fiscal hierarchy**, so any rupee can be followed from the Union Budget down to a ward-level project and back up. This document defines that hierarchy, the urban and rural local-body structures, the geographic hierarchy, the official code systems that make cross-source linkage possible, and how money flows through the levels. The database realization is in [04 — Database Design](../05-data-model/database-design.md).

## Design principle: one hierarchy, many parents

Indian local governance is **not a single clean tree** — an urban ward belongs to a municipal corporation, a rural village belongs to a Gram Panchayat, and both roll up to a district but through different intermediate bodies. The model therefore uses a **generic `admin_unit` closure** (adjacency + closure table) rather than fixed columns, so it can represent urban, rural, and hybrid paths uniformly and still answer "everything under district X" efficiently.

## Administrative hierarchy (governance)

```text
Government of India
  └─ Ministry (central) ─────────────────────────────┐
        │                                             │ (funds flow, not org parent)
        ▼                                             ▼
      State / UT
        └─ Division (revenue division)
             └─ District
                  └─ Taluka / Tehsil
                       └─ Block
                            ├─ URBAN local bodies
                            │    ├─ Municipal Corporation (Mahanagar Palika)
                            │    ├─ Municipality / Municipal Council (Nagar Palika)
                            │    ├─ Town / Nagar Panchayat (Nagar Parishad)
                            │    └─ Cantonment Board
                            │         └─ Ward
                            └─ RURAL local bodies (Panchayati Raj, 3-tier)
                                 ├─ Zilla Parishad          (district tier)
                                 ├─ Panchayat Samiti        (block tier)
                                 └─ Gram Panchayat
                                      └─ Village (revenue village)
                                           └─ Ward / habitation
  All leaf units → Scheme → Project
```

### Level reference

| Level            | Typical unit                                         | Notes                                      |
| ---------------- | ---------------------------------------------------- | ------------------------------------------ |
| Nation           | Government of India                                  | Union Budget origin                        |
| Ministry         | e.g. MoRTH, Rural Development                        | Fund source; not a geographic parent       |
| State / UT       | 28 states + 8 UTs                                    | State budget                               |
| Division         | Revenue division                                     | Present in most states                     |
| District         | ~780 districts                                       | Core rollup level; LGD-coded               |
| Taluka / Tehsil  | Sub-district                                         | Revenue sub-unit                           |
| Block            | Community Development block                          | Rural admin unit                           |
| Urban local body | Corporation / Council / Nagar Panchayat / Cantonment | Urban service delivery                     |
| Zilla Parishad   | District panchayat                                   | Rural, district tier                       |
| Panchayat Samiti | Block panchayat                                      | Rural, intermediate tier                   |
| Gram Panchayat   | Village panchayat                                    | Rural, village tier; owns many local works |
| Village          | Revenue village                                      | Smallest revenue unit                      |
| Ward             | Corporation/GP ward                                  | Smallest governance unit                   |
| Scheme           | CSS/CS/state scheme                                  | Funding vehicle                            |
| Project          | Work / asset                                         | Leaf; where money becomes an asset         |

## Urban local bodies (ULB)

| Body                             | Vernacular                    | Applies to                                                |
| -------------------------------- | ----------------------------- | --------------------------------------------------------- |
| Municipal Corporation            | Mahanagar Palika              | Large cities                                              |
| Municipal Council / Municipality | Nagar Palika / Nagar Parishad | Smaller cities/towns                                      |
| Town Panchayat / Nagar Panchayat | —                             | Transitional/rural-to-urban towns                         |
| Cantonment Board                 | —                             | Military station civilian areas                           |
| Smart City SPV                   | —                             | Mission-specific special purpose vehicle (overlaps a ULB) |

ULBs are coded in the **SBM/ULB code** systems and, increasingly, LGD; the platform stores all known codes per body for cross-source joins.

## Rural local bodies — Panchayati Raj Institutions (PRI)

Three-tier (per the 73rd Amendment), with names/tiers varying by state:

| Tier               | Standard name    | Common state variants                         |
| ------------------ | ---------------- | --------------------------------------------- |
| District           | Zilla Parishad   | Zilla Panchayat                               |
| Block/Intermediate | Panchayat Samiti | Taluka/Mandal/Block Panchayat, Kshetra Samiti |
| Village            | Gram Panchayat   | Village Panchayat, Gaon Panchayat             |

Rural finance flows heavily through **schemes** (e.g. Finance Commission grants to GPs, MGNREGA, PMGSY, PMAY-G), so the model links scheme allocations directly to PRI units.

## Geographic hierarchy (spatial)

Parallel to governance, every unit and asset carries geography (detail in [20 — GIS Intelligence](./gis-intelligence.md)):

```text
Country → State → Division → District → Taluka → Block → Village → Ward → Survey Number → (Latitude, Longitude)
```

- Polygon boundaries at State/District/Taluka/Block/Village/Ward levels (PostGIS `GEOMETRY`).
- **Survey Number** (land parcel) and point coordinates for individual assets.
- Boundary versions are retained (units get created/merged/renamed over time) so historical data maps to the geography that existed then.

## Official code systems (the linkage backbone)

Cross-source reconciliation depends on standard codes; the platform stores them as first-class identifiers so figures from different portals join reliably:

| Code                                      | Scope                           | Used for                                             |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| **LGD (Local Government Directory)** code | State→Village, all local bodies | Primary spatial/admin key across Indian govt systems |
| **Census code** (2011)                    | State→Village/Town              | Demographic joins, legacy datasets                   |
| **ULB code / SBM code**                   | Urban bodies                    | ULB finance & scheme data                            |
| **PRI code**                              | Panchayati Raj units            | Rural finance & scheme data                          |
| **Scheme code**                           | CSS/CS/state schemes            | Allocation/release joins                             |
| **COA / budget head**                     | Budget documents                | Revenue/expenditure classification                   |
| **Work / project ID**                     | Departmental MIS                | Project-level linkage                                |
| **Tender ID**                             | e-procurement                   | Tender↔project↔contractor                            |

Where a source lacks a standard code, the ingestion layer attempts a mapping (deterministic + fuzzy) and records a **confidence**; unresolved cases are flagged, never guessed ([03](../04-data-engineering/data-collection-architecture.md)).

## Financial flow through the hierarchy

```text
Government Revenue (taxes, GST, borrowings, grants, non-tax)
      ▼
Union Budget  ──►  Ministry Allocation
      ▼                    │ (central schemes, transfers, FC grants)
State Allocation ◄─────────┘
      ▼
Division / District Allocation
      ▼
Local-Body Allocation  (ULB via municipal budget · PRI via scheme grants)
      ▼
Department Allocation  ──►  Scheme Allocation
      ▼
Tender  ──►  Contractor
      ▼
Fund Release  ──►  Expenditure  ──►  Work Progress  ──►  Completion
      ▼
Audit  ──►  Variance Detection  ──►  Public Dashboard
```

Money reaches a level by **two mechanisms** the model captures distinctly: (a) **allocation within a budget** (ministry→state→district→body→department→scheme) and (b) **inter-governmental transfers/grants** (Union→State, State→local body, Finance Commission grants). Both terminate in project-level releases and expenditures that the consistency engine checks.

## Consistency across levels

The variance/consistency engine ([06](../07-analytics/analytics-engine.md)) runs **at every level**, not just per project:

- **Vertical roll-up check:** does the sum of children's allocations reconcile with the parent's allocation to them? (e.g. Σ district allocations ≤ state allocation for the scheme.)
- **Horizontal peer check:** compare a unit against sibling units (district vs district, GP vs GP) on normalized metrics (per-capita, per-km, per-bed).
- **Leaf check:** the project-level allocation ≥ release ≥ utilized ordering.

Each check emits only neutral observations (e.g. _"allocations to sub-districts sum to 8% more than the district's recorded allocation for this scheme — records may be incomplete"_).

## Why this matters

Modeling the full hierarchy is what lets the platform answer the mission questions — _which state / district / municipal body / village / department / contractor received and spent the money_ — and check that the figures reconcile **as they cascade down and roll back up**. The hierarchy is the spine; everything else hangs off it.
