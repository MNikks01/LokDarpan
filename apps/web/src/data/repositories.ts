/**
 * The data-access boundary.
 *
 * The UI depends on these interfaces and never on where the records come from.
 * `DemoRepositories` implements them today; a `HttpRepositories` reading
 * `.docs/11-api/client-api-contract.md` replaces it without a component change.
 *
 * The query shapes are deliberately server-shaped — a bounding box, a limit, a
 * cursor — because the national dataset is projected at ~1e10 fact rows
 * (`.docs/14-testing`). Filtering an array in the browser is fine for a demo,
 * but an interface that can only express "give me everything" would have to be
 * rewritten the day it meets real data.
 */
import type { DistrictSummary, LocalBody, StateSummary } from "@/domain/geography";
import type {
  Company,
  CompanyActivity,
  GovernmentDepartment,
  GovernmentOfficer,
  OfficerAssociation,
} from "@/domain/organisation";
import type {
  InfrastructureType,
  ProjectDocument,
  ProjectEvent,
  ProjectStatus,
  ProjectSummary,
  SourceDocument,
  Tender,
} from "@/domain/project";
import type { BBox } from "geojson";

export interface ProjectQuery {
  readonly stateCode?: string;
  readonly districtId?: string;
  readonly localBodyId?: string;
  readonly departmentId?: string;
  readonly infrastructureType?: InfrastructureType;
  readonly statuses?: readonly ProjectStatus[];
  readonly contractorId?: string;
  /** Viewport-scoped loading: the map asks only for what it is showing. */
  readonly withinBbox?: BBox;
  readonly limit?: number;
}

export interface ProjectPage {
  readonly projects: readonly ProjectSummary[];
  /**
   * How many records match the query in total. Rendered as "showing N of M" so
   * a truncated viewport read is never mistaken for the whole picture.
   */
  readonly matchedCount: number;
  readonly datasetVersion: number;
}

/** Everything the detail panel shows for one work, in one payload. */
export interface ProjectDossier {
  readonly project: ProjectSummary;
  readonly department: GovernmentDepartment;
  readonly localBody: LocalBody | null;
  readonly district: DistrictSummary;
  readonly state: StateSummary;
  readonly contractor: Company | null;
  readonly contractorActivity: CompanyActivity | null;
  readonly officers: readonly {
    readonly officer: GovernmentOfficer;
    readonly association: OfficerAssociation;
  }[];
  readonly tender: Tender | null;
  readonly timeline: readonly ProjectEvent[];
  readonly documents: readonly ProjectDocument[];
  readonly sources: readonly SourceDocument[];
  /**
   * One version for the whole payload. Two figures on one screen carrying
   * different vintages is a traceability defect — the reason `.docs/adr/012`
   * chose one REST payload per view over per-field resolution.
   */
  readonly datasetVersion: number;
}

export type SearchResultKind = "project" | "company" | "department" | "place" | "tender";

export interface SearchResult {
  readonly kind: SearchResultKind;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** Where selecting the result takes the explorer. */
  readonly target:
    | { readonly type: "project"; readonly projectId: string }
    | { readonly type: "place"; readonly stateCode: string; readonly districtId: string | null }
    | { readonly type: "route"; readonly href: string };
}

export interface GeographyRepository {
  listStates(): Promise<readonly StateSummary[]>;
  listDistricts(stateCode: string): Promise<readonly DistrictSummary[]>;
  listLocalBodies(districtId: string): Promise<readonly LocalBody[]>;
}

export interface GovernmentRepository {
  listDepartments(scope: { readonly stateCode?: string }): Promise<readonly GovernmentDepartment[]>;
  getDepartment(id: string): Promise<GovernmentDepartment | null>;
  getOfficer(id: string): Promise<GovernmentOfficer | null>;
}

export interface ProjectRepository {
  find(query: ProjectQuery): Promise<ProjectPage>;
  getDossier(projectId: string): Promise<ProjectDossier | null>;
}

export interface CompanyRepository {
  get(id: string): Promise<Company | null>;
  getActivity(id: string): Promise<CompanyActivity | null>;
}

export interface SearchRepository {
  search(term: string): Promise<readonly SearchResult[]>;
}

export interface Repositories {
  readonly geography: GeographyRepository;
  readonly government: GovernmentRepository;
  readonly projects: ProjectRepository;
  readonly companies: CompanyRepository;
  readonly search: SearchRepository;
}
