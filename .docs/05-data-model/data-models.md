# 05 — Data Models (TypeScript)

Shared types used by the API gateway and frontend. They mirror [04 — Database Design](./database-design.md). **Money is represented as an integer/`number` of rupees plus a formatted display string**; never as a float subject to rounding surprises in the UI. Every fact type carries a `provenance` object so the traceability rule is a compile-time expectation, not a convention.

```typescript
// ---------- Primitives & shared ----------

/** Amount in rupees. `inr` is the canonical numeric value; `display` is pre-formatted (₹, crore/lakh). */
export interface Money {
  inr: number; // canonical rupees (paise as decimals allowed)
  display: string; // "₹9.00 crore"
}

export type EstimateType = "BE" | "RE" | "actual"; // Budget/Revised Estimate/Actuals
export type FiscalYearLabel = `FY${number}-${number}`; // "FY2024-25"

/** Provenance is mandatory on every fact returned to a client. */
export interface Provenance {
  sourceDocumentId: number;
  sourceName: string; // "Maharashtra PWD — Works"
  sourceUrl: string | null; // direct link shown to the user
  retrievedAt: string; // ISO timestamp
  publishedAt: string | null; // ISO date
  extractionMethod: string; // "api" | "camelot" | "ocr:tesseract" | ...
  confidence: number; // 0..1
}

/** Wraps any value that could be missing, so the UI can show a missing-data warning. */
export interface Traceable<T> {
  value: T | null;
  missingReason: string | null; // non-null iff value is null
  provenance: Provenance | null;
}

export interface Versioned {
  recordVersion: number;
  supersededById: number | null; // null = current
  validFrom: string;
  validTo: string | null;
}

// ---------- Government hierarchy & geo ----------

export interface Department {
  id: number;
  ministryId: number;
  ministryName: string;
  name: string; // "Public Works Department"
  code: string | null;
  domain: string | null; // "roads"
  tier: "central" | "state";
  stateCode: string | null; // "MH"
}

export interface District {
  id: number;
  lgdCode: string | null;
  name: string;
  stateCode: string; // "MH"
  geometry?: GeoJSON.MultiPolygon;
}

// ---------- Revenue ----------

export type TaxHead = "income_tax" | "corporation_tax" | "stamp_duty" | "vehicle_tax" | "other";

export interface Revenue {
  id: number;
  fiscalYear: FiscalYearLabel;
  kind: "tax" | "gst" | "excise" | "borrowing" | "grant";
  head: string; // tax head / GST component / grant type
  amount: Money;
  estimateType: EstimateType | null;
  provenance: Provenance;
}

// ---------- Budget & allocation ----------

/** A budget line at any level of the hierarchy (dept-level or project-level). */
export interface Budget {
  id: number;
  fiscalYear: FiscalYearLabel;
  departmentId: number | null;
  projectId: number | null;
  schemeCode: string | null;
  amount: Money;
  estimateType: EstimateType | null;
  isRevision: boolean;
  provenance: Provenance;
  versioning: Versioned;
}

export interface Allocation extends Budget {} // allocation is the canonical budget line

// ---------- Projects, roads, bridges ----------

export type ProjectCategory =
  "state_highway" | "national_highway" | "bridge" | "rural_road" | "urban_road" | "other";

export type ProjectStatus =
  "sanctioned" | "tendered" | "in_progress" | "completed" | "stalled" | "unknown";

export interface Project {
  id: number;
  externalWorkId: string | null;
  name: string;
  category: ProjectCategory;
  status: ProjectStatus;
  department: Pick<Department, "id" | "name">;
  districtId: number | null;
  schemeCode: string | null;
  fiscalYear: FiscalYearLabel | null;
  sanctionedAmount: Money | null;
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  provenance: Provenance;
  versioning: Versioned;
}

export interface Road {
  id: number;
  projectId: number;
  districtId: number | null;
  roadClass: "NH" | "SH" | "MDR" | "ODR" | "rural" | "urban" | null;
  lengthKm: number | null;
  widthM: number | null;
  surfaceType: string | null;
  geometry?: GeoJSON.MultiLineString;
  provenance: Provenance;
}

export interface Bridge {
  id: number;
  projectId: number;
  districtId: number | null;
  spanM: number | null;
  bridgeType: string | null;
  overFeature: string | null;
  geometry?: GeoJSON.Point;
  provenance: Provenance;
}

export interface ProjectProgress {
  id: number;
  projectId: number;
  asOfDate: string;
  physicalPct: number | null; // 0..100
  financialPct: number | null; // 0..100
  statusNote: string | null;
  provenance: Provenance;
}

// ---------- Contractors & tenders ----------

export interface Contractor {
  id: number;
  canonicalName: string;
  registrationNo: string | null;
  classGrade: string | null;
  aliases?: string[]; // raw name variants, for transparency of canonicalization
}

export type TenderStatus = "published" | "bidding" | "awarded" | "cancelled" | "unknown";

export interface Tender {
  id: number;
  externalTenderId: string | null;
  projectId: number | null;
  departmentId: number | null;
  contractor: Pick<Contractor, "id" | "canonicalName"> | null;
  title: string | null;
  estimatedCost: Money | null;
  awardedAmount: Money | null;
  numBidders: number | null;
  publishedDate: string | null;
  awardedDate: string | null;
  status: TenderStatus;
  provenance: Provenance;
  versioning: Versioned;
}

// ---------- Finance flow ----------

export interface Expenditure {
  id: number;
  fiscalYear: FiscalYearLabel;
  projectId: number | null;
  amount: Money;
  expenseDate: string | null;
  headOfAccount: string | null;
  provenance: Provenance;
  versioning: Versioned;
}

/** Per-project financial rollup + derived consistency metrics (see docs 06 & 08). */
export interface ProjectFinance {
  projectId: number;
  allocated: Money;
  released: Money;
  utilized: Money;
  variance: Money; // released − utilized (or allocated − utilized, per context; see note)
  deviationPct: number; // signed %; formula in doc 06
  costPerKmInr: number | null; // utilized / length_km, roads only (doc 08)
  status: "consistent" | "needs_verification" | "insufficient_data";
  missingData: string[]; // e.g. ["No expenditure records for FY2024-25"]
}

// ---------- Audit ----------

export type AnomalyType =
  | "variance_gap"
  | "utilization_exceeds_release"
  | "release_exceeds_allocation"
  | "cost_per_km_outlier"
  | "missing_records"
  | "budget_revision_spike"
  | "contractor_concentration"
  | "delay";

export type Severity = "info" | "low" | "medium" | "high";

export interface AnomalyEvidence {
  table: string;
  rowId: number;
  sourceDocumentId: number;
  sourceUrl: string | null;
}

export interface Anomaly {
  id: number;
  type: AnomalyType;
  severity: Severity;
  /** Neutral, factual observation ONLY. Never an allegation. Validated per doc 15. */
  observation: string;
  metricValue: number | null;
  thresholdValue: number | null;
  confidence: number; // 0..1
  scope: { projectId?: number; districtId?: number; departmentId?: number };
  evidence: AnomalyEvidence[];
  detectedAt: string;
  datasetVersion: number;
}

export interface RiskScore {
  projectId: number;
  score: number; // 0..100
  factors: Record<string, { contribution: number; note: string }>;
  computedAt: string;
  datasetVersion: number;
}

// ---------- API envelope ----------

export interface Page<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    datasetVersion: number;
    asOf: string; // ISO timestamp of the data snapshot
  };
}
```
