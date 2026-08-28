/**
 * The organisational side of the graph: who commissioned a work, who built it,
 * and who held a role on it.
 *
 * NEUTRALITY (`.docs/17-legal/legal-ethical-rules.md`, binding):
 * A company record carries no score, no rank, no badge and no flag, and an
 * officer record states a ROLE and a PERIOD, never responsibility for an
 * outcome. The omission is deliberate; see `.docs/05-data-model/screen-data-matrix.md` §3.
 * There is nowhere in these types to put such a field, which is the point.
 */

export type GovernmentTier = "central" | "state" | "local";

export interface GovernmentDepartment {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly tier: GovernmentTier;
  /** Null for a central body that is not scoped to one state. */
  readonly stateCode: string | null;
  readonly parentMinistry: string | null;
}

export interface Company {
  readonly id: string;
  readonly name: string;
  /**
   * Registration identifier as printed in the award record. Demo records carry
   * a placeholder rather than an invented CIN, so nothing here can be mistaken
   * for a real registry entry.
   */
  readonly registrationId: string;
  readonly registeredOfficeCity: string;
  readonly registeredOfficeStateCode: string;
}

/**
 * Counts of a company's appearances in the records held. Presented as
 * "in the records held", never as a total or a ranking — this platform does not
 * claim to have seen every contract awarded in India.
 */
export interface CompanyActivity {
  readonly projectCount: number;
  readonly totalContractValueInr: string;
  readonly stateCodes: readonly string[];
  readonly departmentIds: readonly string[];
}

/**
 * The role an officer held on a record, drawn from the document that names
 * them. These are the only permitted descriptors: each states a function under
 * a rule of business, and none of them implies an outcome.
 */
export type OfficerRole =
  | "executive_engineer"
  | "approving_authority"
  | "project_engineer"
  | "supervising_authority"
  | "tender_inviting_authority";

export const OFFICER_ROLE_LABEL: Readonly<Record<OfficerRole, string>> = {
  executive_engineer: "Executive Engineer",
  approving_authority: "Approving Authority",
  project_engineer: "Project Engineer",
  supervising_authority: "Supervising Authority",
  tender_inviting_authority: "Tender Inviting Authority",
};

export interface GovernmentOfficer {
  readonly id: string;
  readonly name: string;
  readonly designation: string;
  readonly departmentId: string;
  readonly office: string;
}

/** An officer's association with one record — a role held over a period. */
export interface OfficerAssociation {
  readonly officerId: string;
  readonly role: OfficerRole;
  readonly periodFrom: string | null;
  readonly periodTo: string | null;
  /** The document in which the association is recorded. */
  readonly sourceDocumentId: number;
}
