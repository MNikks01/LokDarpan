/**
 * A work of infrastructure, and the record chain behind it.
 *
 * Money never appears here as a number. Every monetary value is a `Figure` from
 * `@lokdarpan/contracts` — either present WITH provenance, or explicitly
 * missing with the source that would carry it. `<Figure>` is then the only way
 * to render it, so a value cannot reach a reader without its source.
 */
import type { Figure, Provenance } from "@lokdarpan/contracts";
import type { Feature, LineString } from "geojson";

export type InfrastructureType = "road" | "bridge" | "flyover" | "highway" | "other";

export const INFRASTRUCTURE_LABEL: Readonly<Record<InfrastructureType, string>> = {
  road: "Roads",
  bridge: "Bridges",
  flyover: "Flyovers",
  highway: "Highways",
  other: "Other",
};

/**
 * Status is a FACT READ FROM A RECORD, not an assessment.
 *
 * `.docs/17-legal/legal-ethical-rules.md` is why there is no "problem" or
 * "attention required" member here, though a generic brief would ask for one: a
 * status that editorialises asserts fault before the reader has seen a figure.
 * `behind_recorded_schedule` states an arithmetic comparison of two dates in the
 * record and nothing more, and `records_incomplete` is a statement about our
 * holdings, never about the body that publishes them.
 */
export type ProjectStatus =
  "completed" | "in_progress" | "behind_recorded_schedule" | "proposed" | "records_incomplete";

export interface ProjectSummary {
  readonly id: string;
  /** The identifier printed on the government record. */
  readonly externalId: string;
  readonly name: string;
  readonly infrastructureType: InfrastructureType;
  readonly status: ProjectStatus;
  readonly stateCode: string;
  readonly districtId: string;
  readonly localBodyId: string | null;
  readonly departmentId: string;
  readonly contractorId: string | null;
  readonly contractValue: Figure;
  readonly lengthKm: number | null;
  readonly fiscalYear: string;
  readonly geometry: Feature<LineString, Record<string, never>>;
}

export interface Tender {
  readonly id: string;
  readonly externalId: string;
  readonly projectId: string;
  readonly publishedOn: string;
  readonly bidsCloseOn: string | null;
  readonly method: "open_tender" | "limited_tender" | "single_source" | "rate_contract";
  readonly estimatedCost: Figure;
  readonly awardedValue: Figure;
  /** Null where the bid summary was not published — never rendered as 0. */
  readonly bidderCount: number | null;
  readonly awardedToCompanyId: string | null;
  readonly invitingAuthorityOfficerId: string | null;
}

export const TENDER_METHOD_LABEL: Readonly<Record<Tender["method"], string>> = {
  open_tender: "Open tender",
  limited_tender: "Limited tender",
  single_source: "Single source",
  rate_contract: "Rate contract",
};

export type DocumentKind =
  | "tender_notice"
  | "work_order"
  | "agreement"
  | "project_report"
  | "completion_certificate"
  | "payment_record"
  | "audit_report";

export const DOCUMENT_KIND_LABEL: Readonly<Record<DocumentKind, string>> = {
  tender_notice: "Tender notice",
  work_order: "Work order",
  agreement: "Agreement",
  project_report: "Project report",
  completion_certificate: "Completion certificate",
  payment_record: "Payment record",
  audit_report: "Audit report",
};

/**
 * Availability is three-valued on purpose. "Not published" and "we have not
 * collected it" are different statements about different parties, and merging
 * them into one absent state would let a gap in OUR holdings read as a failure
 * to publish by a government body.
 */
export type DocumentAvailability = "held" | "referenced_not_held" | "not_published";

export interface ProjectDocument {
  readonly id: string;
  readonly projectId: string;
  readonly kind: DocumentKind;
  readonly title: string;
  readonly format: "pdf" | "xls" | "html" | "scan";
  readonly documentDate: string | null;
  readonly issuedBy: string;
  readonly availability: DocumentAvailability;
  /** Present only when `availability` is "held". */
  readonly sourceDocumentId: number | null;
}

/**
 * A dated entry in the record chain. `recorded` distinguishes an event that has
 * happened from one a document merely schedules, so a planned completion date
 * is never rendered as an accomplished one.
 */
export type ProjectEventKind =
  | "tender_published"
  | "bids_closed"
  | "contract_awarded"
  | "work_started"
  | "expected_completion"
  | "completed";

export const PROJECT_EVENT_LABEL: Readonly<Record<ProjectEventKind, string>> = {
  tender_published: "Tender published",
  bids_closed: "Bid submission closed",
  contract_awarded: "Contract awarded",
  work_started: "Work started",
  expected_completion: "Expected completion",
  completed: "Recorded as completed",
};

export interface ProjectEvent {
  readonly kind: ProjectEventKind;
  readonly date: string;
  readonly recorded: boolean;
  readonly sourceDocumentId: number | null;
}

/** A source document, as cited by a figure or listed under Documents. */
export interface SourceDocument {
  readonly id: number;
  readonly title: string;
  readonly authority: string;
  readonly publishedOn: string | null;
  readonly retrievedAt: string;
  readonly provenance: Provenance;
}
