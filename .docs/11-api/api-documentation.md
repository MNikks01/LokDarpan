# 10 — API Documentation

**Base URL:** `https://api.lokdarpan.org/api` (illustrative). **Version:** `v1` (prefix `/api/v1`). **Format:** JSON. **Auth:** public read endpoints are open but rate-limited; higher quotas require an API key ([13](../12-security/security.md)). **All responses are read-only** — the public API never mutates the ledger.

## Conventions

- **Envelope:** list endpoints return `{ data, meta }`; single-resource endpoints return `{ data }`. Errors return `{ error }`.
- **Provenance:** every fact object embeds `provenance` (source id, url, method, confidence, retrievedAt). Derived objects embed the inputs they used.
- **Data version:** `meta.datasetVersion` and `meta.asOf` accompany every response for reproducibility. Clients may pin a version with `?version=N`.
- **Money:** `{ inr, display }`. **Nulls** for missing values come with a sibling `*_missingReason` where relevant.
- **Times:** ISO-8601, UTC.

### Pagination (cursor + page)

```text
?page=1&pageSize=25          # page-based (default pageSize 25, max 100)
meta: { page, pageSize, total, datasetVersion, asOf }
```

### Filtering

`?filter[field]=value`, repeatable; ranges via `field_gte` / `field_lte`.

```text
?filter[district]=PUNE&filter[category]=rural_road&deviationPct_gte=10
```

### Sorting

```text
?sort=deviationPct        # ascending
?sort=-deviationPct       # descending (prefix -)
?sort=-riskScore,name     # multi-key
```

### Standard error shape

```json
{ "error": { "code": "NOT_FOUND", "message": "Project 999 not found", "requestId": "req_abc" } }
```
Codes: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `RATE_LIMITED` (429), `INTERNAL` (500).

---

## Endpoints

### `GET /revenue`
State/central revenue lines.

Query: `filter[fiscalYear]`, `filter[kind]` (`tax|gst|excise|borrowing|grant`), `filter[estimateType]`, `sort`, `page`, `pageSize`, `version`.

```json
// 200
{
  "data": [
    {
      "id": 12, "fiscalYear": "FY2024-25", "kind": "gst", "head": "SGST",
      "amount": { "inr": 4200000000000, "display": "₹4,20,000 crore" },
      "estimateType": "actual",
      "provenance": { "sourceDocumentId": 88, "sourceName": "MH Finance — Budget at a Glance",
        "sourceUrl": "https://...", "retrievedAt": "2026-06-01T04:00:00Z",
        "publishedAt": "2025-03-10", "extractionMethod": "camelot", "confidence": 0.98 }
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "total": 41, "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

### `GET /projects`
List projects with finance rollup and verification priority.

Query: `filter[district]`, `filter[department]`, `filter[category]`, `filter[status]`, `filter[fiscalYear]`, `deviationPct_gte`, `riskScore_gte`, `sort`, `page`, `pageSize`.

```json
{
  "data": [
    {
      "id": 501, "name": "Upgradation of ODR-14, Baramati", "category": "rural_road",
      "status": "in_progress", "district": { "id": 7, "name": "Pune" },
      "department": { "id": 3, "name": "Public Works Department" },
      "finance": {
        "allocated": { "inr": 100000000, "display": "₹10.00 crore" },
        "released":  { "inr": 90000000,  "display": "₹9.00 crore" },
        "utilized":  { "inr": 80000000,  "display": "₹8.00 crore" },
        "variance":  { "inr": 10000000,  "display": "₹1.00 crore" },
        "deviationPct": 11.1, "status": "needs_verification",
        "missingData": []
      },
      "riskScore": 40,
      "provenance": { "sourceDocumentId": 220, "sourceUrl": "https://...", "confidence": 1.0,
        "sourceName": "MH PWD — Works", "retrievedAt": "2026-07-30T02:00:00Z",
        "publishedAt": "2025-12-01", "extractionMethod": "api" }
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "total": 1832, "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

### `GET /projects/:id`
Full project record including roads/bridges, contractor, timeline refs, observations, and road intelligence.

```json
{
  "data": {
    "id": 501, "name": "Upgradation of ODR-14, Baramati", "category": "rural_road",
    "status": "in_progress", "externalWorkId": "PWD-PUN-2024-1408",
    "department": { "id": 3, "name": "Public Works Department" },
    "district": { "id": 7, "name": "Pune" },
    "roads": [ { "id": 900, "lengthKm": 10.0, "widthM": 7.0, "surfaceType": "bituminous",
                 "roadClass": "ODR", "provenance": { "confidence": 1.0, "sourceUrl": "https://..." } } ],
    "roadIntelligence": {
      "costPerKmActualInr": 32000000, "costPerKmExpectedInr": 26000000,
      "deviationModelPct": 23.1, "deviationDistrictPct": 16.4, "peerN": 19,
      "expectedAsphaltTonnes": 19320, "modelVersion": "road-model-2026.1"
    },
    "contractor": { "id": 61, "canonicalName": "ABC Infra Pvt Ltd", "aliases": ["ABC Infra", "A.B.C. Infra P. Ltd"] },
    "observations": [
      { "id": 7001, "type": "variance_gap", "severity": "low",
        "observation": "Utilized amount is 11.1% below released amount.",
        "metricValue": 11.1, "thresholdValue": 10, "confidence": 1.0 }
    ],
    "provenance": { "sourceDocumentId": 220, "sourceUrl": "https://...", "confidence": 1.0,
      "sourceName": "MH PWD — Works", "retrievedAt": "2026-07-30T02:00:00Z",
      "publishedAt": "2025-12-01", "extractionMethod": "api" }
  },
  "meta": { "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

### `GET /projects/:id/finance`
Just the finance chain + derived metrics + the underlying line items (each source-linked).

```json
{
  "data": {
    "projectId": 501,
    "allocations": [ { "id": 1, "amount": { "inr": 100000000, "display": "₹10.00 crore" },
      "estimateType": "BE", "fiscalYear": "FY2024-25", "provenance": { "sourceUrl": "https://...", "confidence": 1.0 } } ],
    "releases":    [ { "id": 5, "amount": { "inr": 90000000, "display": "₹9.00 crore" },
      "installmentNo": 1, "releaseDate": "2024-11-02", "provenance": { "sourceUrl": "https://...", "confidence": 1.0 } } ],
    "expenditures":[ { "id": 9, "amount": { "inr": 80000000, "display": "₹8.00 crore" },
      "expenseDate": "2025-02-20", "provenance": { "sourceUrl": "https://...", "confidence": 0.96 } } ],
    "derived": { "allocated": 100000000, "released": 90000000, "utilized": 80000000,
      "releaseVarianceInr": 10000000, "deviationPct": 11.1, "status": "needs_verification" }
  },
  "meta": { "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

### `GET /anomalies`
Neutral observations across scope.

Query: `filter[type]`, `filter[severity]`, `filter[district]`, `filter[department]`, `filter[projectId]`, `sort=-detectedAt`, pagination.

```json
{
  "data": [
    { "id": 7042, "type": "cost_per_km_outlier", "severity": "medium",
      "observation": "Reported cost per km is 23% above the modeled estimate and 16% above the district median (n=19).",
      "metricValue": 23.1, "thresholdValue": 15, "confidence": 0.97,
      "scope": { "projectId": 501, "districtId": 7 },
      "evidence": [ { "table": "expenditure", "rowId": 9, "sourceUrl": "https://..." },
                    { "table": "road", "rowId": 900, "sourceUrl": "https://..." } ],
      "detectedAt": "2026-08-01T03:00:00Z", "datasetVersion": 137 }
  ],
  "meta": { "page": 1, "pageSize": 25, "total": 214, "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

### `GET /districts/:id`
District profile: geometry, revenue-linked scope, project/road/bridge counts, aggregate finance, median cost/km, concentration.

```json
{
  "data": {
    "id": 7, "name": "Pune", "lgdCode": "521",
    "counts": { "projects": 142, "roads": 118, "bridges": 24 },
    "finance": { "allocated": { "inr": 0, "display": "₹— crore" }, "released": {}, "utilized": {} },
    "medians": { "costPerKmInr": 27500000, "peerN": 118 },
    "contractorConcentration": { "hhi": 1420, "top3SharePct": 39.0, "label": "low concentration" },
    "geometry": { "type": "MultiPolygon", "coordinates": [] }
  },
  "meta": { "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

### `GET /contractors/:id`
Contractor profile — **descriptive statistics only**, no characterization.

```json
{
  "data": {
    "id": 61, "canonicalName": "ABC Infra Pvt Ltd", "classGrade": "Class I-A",
    "aliases": ["ABC Infra", "A.B.C. Infra P. Ltd"],
    "tenders": { "count": 12, "totalAwardedInr": 640000000, "avgBidders": 4.2 },
    "scopeShare": [ { "scope": "Baramati taluka, FY2024-25", "sharePct": 34.0, "hhiContext": 3120 } ],
    "provenanceNote": "Aggregated from official e-tender award records; names canonicalized from listed variants."
  },
  "meta": { "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

### Supporting endpoints

| Method & path | Purpose |
|---|---|
| `GET /departments` / `GET /departments/:id` | Ministry/department hierarchy & rollups |
| `GET /tenders` / `GET /tenders/:id` | Tender records with award + bidder counts |
| `GET /projects/:id/timeline` | Ordered events (sanction/tender/release/expenditure/progress) |
| `GET /projects/:id/risk` | Risk score + full factor breakdown |
| `GET /reports/:id` | Generated neutral report (system/AI/analyst) |
| `GET /sources` / `GET /sources/:docId` | Source registry & a specific source document (the traceability endpoint) |
| `GET /meta/dataset-versions` | List dataset versions for pinning/reproducibility |
| `POST /ai/ask` | Guardrailed Q&A (see [11](../09-ai/ai-layer.md)); body `{ question, scope }`, returns answer + citations |
| `GET /export/:resource` | CSV/JSON bulk export with embedded source links |

### `POST /ai/ask` (guardrailed)

```json
// request
{ "question": "How much was allocated vs utilized for rural roads in Pune in FY2024-25?",
  "scope": { "district": "Pune", "fiscalYear": "FY2024-25", "category": "rural_road" } }

// 200
{ "data": {
    "answer": "For rural roads in Pune (FY2024-25), ingested official records show ₹— crore allocated and ₹— crore utilized, a deviation of —%. Figures are drawn from the sources cited below.",
    "citations": [ { "sourceDocumentId": 220, "sourceUrl": "https://...", "confidence": 1.0 } ],
    "guardrail": { "refusedClaims": [], "note": "Answer restricted to ingested official figures; no inference of cause." }
  },
  "meta": { "datasetVersion": 137, "asOf": "2026-08-04T22:10:00Z" }
}
```

## Rate limiting & caching (client-facing)

- Anonymous: e.g. 60 req/min; keyed: higher tiers. `429` returns `Retry-After`.
- Responses are cacheable; `ETag` per `datasetVersion`. Send `If-None-Match` to get `304`.
- Pin `?version=N` for reproducible research queries; omit for latest.

---

## National-scale endpoints (hierarchy)

Read-only, same envelope/provenance rules. `unitId` is an `admin_unit` id ([19](../03-domain/administrative-hierarchy.md)).

| Method & path | Purpose |
|---|---|
| `GET /states` / `GET /states/:id` | States/UTs with finance rollups |
| `GET /divisions/:id` · `GET /districts/:id` · `GET /talukas/:id` · `GET /blocks/:id` | Level-specific rollups |
| `GET /units/:id` | Any `admin_unit` (generic) — finance, children, assets |
| `GET /units/:id/children` | Direct children (drill-down) |
| `GET /units/:id/rollup` | Aggregated allocation/release/expenditure for the whole subtree |
| `GET /units/:id/consistency` | Vertical roll-up gap check ([06 §10](../07-analytics/analytics-engine.md)) |
| `GET /villages/:id` / `GET /local-bodies/:id` | GP/ULB finance, scheme grants, works |
| `GET /ministries` / `GET /ministries/:id` | Ministry rollups & scheme list |
| `GET /schemes` / `GET /schemes/:id` | Scheme allocations/releases across units |
| `GET /transfers` | Inter-governmental transfers/grants (filter by from/to unit, scheme) |
| `GET /facilities/:id` · `GET /roads/:id` · `GET /assets` | Social/utility/transport assets (filter by type, unit, bbox) |
| `GET /geo/units/:id` | GeoJSON boundary; `GET /tiles/{layer}/{z}/{x}/{y}.mvt` vector tiles ([20](../03-domain/gis-intelligence.md)) |

`GET /units/:id` filter examples:

```text
GET /units/532/rollup?filter[scheme]=PMGSY&filter[fiscalYear]=FY2024-25
GET /assets?filter[type]=hospital&filter[unit]=532&bbox=73.7,18.4,74.0,18.7
GET /districts/7?include=children,consistency
```

## Authentication & authorization

- **Public reads:** open, rate-limited, no key. Higher quotas/exports need an API key (`Authorization: Bearer <key>`); roles per [13](../12-security/security.md) (`public`/`journalist`/`researcher`/`analyst`/`admin`).
- **No public write endpoints** — the ledger is mutated only by internal ETL. Analyst/admin operations use a separate, SSO+MFA-gated internal API, fully audited.
- **Scopes** on keys (e.g. `read:core`, `read:bulk`, `ai:ask`); `403` on scope violation.

## GraphQL API

A single `/graphql` endpoint complements REST for hierarchical, nested reads (drill-downs fetch a unit + children + assets + finance in one round trip). Read-only; same auth, rate limits, provenance, and `datasetVersion` semantics.

```graphql
scalar DateTime
type Money { inr: Float!, display: String! }
type Provenance { sourceDocumentId: Int!, sourceUrl: String, confidence: Float!, retrievedAt: DateTime! }

type Finance {
  allocated: Money!
  released: Money!
  utilized: Money!
  varianceInr: Float!
  deviationPct: Float
  status: String!           # consistent | needs_verification | insufficient_data
  missingData: [String!]!
}

type AdminUnit {
  id: ID!
  level: String!            # nation | state | district | ... | ward
  name: String!
  lgdCode: String
  population: Int
  parent: AdminUnit
  children(level: String): [AdminUnit!]!
  finance(fiscalYear: String, scheme: String): Finance!
  rollup(fiscalYear: String, scheme: String): Finance!     # whole subtree
  consistency(fiscalYear: String, scheme: String): RollupCheck!
  projects(status: String, category: String, page: Int, pageSize: Int): ProjectPage!
  facilities(type: String): [Facility!]!
  observations: [Anomaly!]!
  provenance: Provenance!
}

type RollupCheck { gapInr: Float!, gapPct: Float, coverage: String!, observation: String! }

type Project {
  id: ID!
  name: String!
  category: String!
  status: String!
  unit: AdminUnit
  scheme: Scheme
  finance: Finance!
  riskScore: Int
  contractor: Contractor
  observations: [Anomaly!]!
  provenance: Provenance!
}
type ProjectPage { data: [Project!]!, total: Int!, datasetVersion: Int! }

type Scheme { id: ID!, code: String, name: String!, ministry: Ministry, domain: String }
type Ministry { id: ID!, name: String!, tier: String!, schemes: [Scheme!]! }
type Contractor { id: ID!, canonicalName: String! }
type Anomaly {
  id: ID!, type: String!, severity: String!, observation: String!,   # neutral only (doc 15)
  metricValue: Float, confidence: Float!, evidence: [Evidence!]!
}
type Evidence { table: String!, rowId: Int!, sourceUrl: String }

type Query {
  adminUnit(id: ID, lgdCode: String): AdminUnit
  states: [AdminUnit!]!
  project(id: ID!): Project
  scheme(id: ID, code: String): Scheme
  anomalies(type: String, severity: String, unitId: ID, page: Int, pageSize: Int): [Anomaly!]!
  # AI Q&A is guardrailed (doc 11); returns answer + citations
  ask(question: String!, scope: ScopeInput): AiAnswer!
}
input ScopeInput { unitId: ID, fiscalYear: String, scheme: String, category: String }
type AiAnswer { answer: String!, citations: [Provenance!]!, refusedClaims: [String!]! }
```

Example drill-down query (one round trip):

```graphql
query District($id: ID!) {
  adminUnit(id: $id) {
    name
    rollup(fiscalYear: "FY2024-25") { allocated { display } utilized { display } deviationPct status }
    consistency(fiscalYear: "FY2024-25") { gapPct observation }
    children(level: "block") { name finance(fiscalYear: "FY2024-25") { utilized { display } } }
    observations { type severity observation }
  }
}
```

**Guardrails:** GraphQL is depth- and complexity-limited (cost analysis) to prevent abusive nested queries; persisted queries recommended for the public app; the AI `ask` field is bound by the same neutrality stack as REST ([11](../09-ai/ai-layer.md)).
