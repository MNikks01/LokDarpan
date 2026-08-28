import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Money } from "@lokdarpan/money";
import type {
  BoundaryManifest,
  DistrictSummary,
  LocalBody,
  StateSummary,
} from "@/domain/geography";
import type {
  Company,
  CompanyActivity,
  GovernmentDepartment,
  GovernmentOfficer,
} from "@/domain/organisation";
import type { ProjectSummary } from "@/domain/project";
import { DEMO_COMPANIES, DEMO_DEPARTMENTS, DEMO_OFFICERS } from "./demo/organisations";
import { DEMO_LOCAL_BODIES } from "./demo/places";
import { DEMO_PROJECTS, type DemoProjectRecord } from "./demo/projects";
import { DEMO_DATASET_VERSION, demoSource } from "./demo/sources";
import type {
  CompanyRepository,
  GeographyRepository,
  GovernmentRepository,
  ProjectDossier,
  ProjectPage,
  ProjectQuery,
  ProjectRepository,
  Repositories,
  SearchRepository,
  SearchResult,
} from "./repositories";
import type { BBox, Position } from "geojson";

/**
 * The in-repository implementation of the data boundary.
 *
 * Geography comes from the manifest written by `scripts/fetch-boundaries.ts`;
 * works, firms and officers come from the demo dataset. Swapping this object
 * for one that calls `.docs/11-api/client-api-contract.md` is the whole of the
 * backend migration as far as the UI is concerned.
 */

/**
 * Thrown when boundary geometry has not been prepared. It is a distinct type,
 * not a generic failure, because the fix is a specific command and the page can
 * only say so if it can tell this apart from a genuine error.
 */
export class GeometryNotInstalledError extends Error {
  readonly command = "pnpm --filter @lokdarpan/web geo:fetch";
  constructor() {
    super("Administrative boundary geometry has not been prepared in this checkout.");
    this.name = "GeometryNotInstalledError";
  }
}

let manifestPromise: Promise<BoundaryManifest> | null = null;

export async function loadBoundaryManifest(): Promise<BoundaryManifest> {
  manifestPromise ??= readFile(join(process.cwd(), "public", "geo", "manifest.json"), "utf8")
    .then((raw) => JSON.parse(raw) as BoundaryManifest)
    .catch(() => {
      // Reset so a later request retries rather than caching the failure for
      // the life of the process — the file appears the moment the script runs.
      manifestPromise = null;
      throw new GeometryNotInstalledError();
    });
  return manifestPromise;
}

export const districtId = (stateCode: string, districtCode: string): string =>
  `${stateCode}-${districtCode}`;

/**
 * Fallback label anchor for a manifest generated before label points existed,
 * so an existing checkout keeps working without re-running `geo:fetch`.
 */
function spanOf(box: BBox): number {
  const [west, south, east, north] = box;
  return (east - west) * (north - south);
}

function centreOf(box: BBox): readonly [number, number] {
  const [west, south, east, north] = box;
  return [(west + east) / 2, (south + north) / 2];
}

const geography: GeographyRepository = {
  async listStates(): Promise<readonly StateSummary[]> {
    const manifest = await loadBoundaryManifest();
    return manifest.states.map((s) => ({
      id: s.code,
      code: s.code,
      name: s.name,
      slug: s.slug,
      bbox: s.bbox,
      labelPoint: s.labelPoint ?? centreOf(s.bbox),
      labelWeight: s.labelWeight ?? spanOf(s.bbox),
      districtCount: s.districtCount,
    }));
  },

  async listDistricts(stateCode: string): Promise<readonly DistrictSummary[]> {
    const manifest = await loadBoundaryManifest();
    const districts = manifest.districts[stateCode] ?? [];
    return [...districts]
      .map((d) => ({
        id: districtId(stateCode, d.code),
        code: d.code,
        stateCode,
        name: d.name,
        slug: d.slug,
        bbox: d.bbox,
        labelPoint: d.labelPoint ?? centreOf(d.bbox),
        labelWeight: d.labelWeight ?? spanOf(d.bbox),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  listLocalBodies(district: string): Promise<readonly LocalBody[]> {
    return Promise.resolve(DEMO_LOCAL_BODIES.filter((b) => b.districtId === district));
  },
};

const government: GovernmentRepository = {
  listDepartments(scope): Promise<readonly GovernmentDepartment[]> {
    const { stateCode } = scope;
    if (stateCode === undefined) return Promise.resolve(DEMO_DEPARTMENTS);
    // A central body is in scope everywhere: it commissions works in every
    // state, so filtering it out with the state filter would hide real records.
    return Promise.resolve(
      DEMO_DEPARTMENTS.filter((d) => d.stateCode === null || d.stateCode === stateCode),
    );
  },
  getDepartment(id): Promise<GovernmentDepartment | null> {
    return Promise.resolve(DEMO_DEPARTMENTS.find((d) => d.id === id) ?? null);
  },
  getOfficer(id): Promise<GovernmentOfficer | null> {
    return Promise.resolve(DEMO_OFFICERS.find((o) => o.id === id) ?? null);
  },
};

/** A line is "within" a box when any vertex is — enough for viewport scoping. */
function touchesBbox(project: ProjectSummary, box: BBox): boolean {
  const [west, south, east, north] = box;
  return project.geometry.geometry.coordinates.some((position: Position) => {
    const lng = position[0];
    const lat = position[1];
    return (
      lng !== undefined &&
      lat !== undefined &&
      lng >= west &&
      lng <= east &&
      lat >= south &&
      lat <= north
    );
  });
}

function matches(project: ProjectSummary, query: ProjectQuery): boolean {
  // The scalar filters are all the same shape — "if the caller named a value,
  // it must equal the record's" — so they are compared as data rather than as
  // eight near-identical branches.
  const equalities: readonly (readonly [string | undefined, string | null])[] = [
    [query.stateCode, project.stateCode],
    [query.districtId, project.districtId],
    [query.localBodyId, project.localBodyId],
    [query.departmentId, project.departmentId],
    [query.contractorId, project.contractorId],
    [query.infrastructureType, project.infrastructureType],
  ];
  if (equalities.some(([wanted, actual]) => wanted !== undefined && wanted !== actual))
    return false;
  if (query.statuses !== undefined && !query.statuses.includes(project.status)) return false;
  if (query.withinBbox !== undefined && !touchesBbox(project, query.withinBbox)) return false;
  return true;
}

/**
 * Every source document a figure or a date on the detail panel was read from.
 * The panel's bibliography must list exactly what it cites — no more, so it is
 * not a catalogue, and no less, so no figure is uncitable.
 */
function citedSourceIds(record: DemoProjectRecord): readonly number[] {
  const ids = new Set<number>();
  const { project, tender, documents, timeline } = record;
  if (project.contractValue.present) ids.add(project.contractValue.provenance.sourceDocumentId);
  if (tender !== null) {
    for (const figure of [tender.estimatedCost, tender.awardedValue]) {
      if (figure.present) ids.add(figure.provenance.sourceDocumentId);
    }
  }
  for (const document of documents) {
    if (document.sourceDocumentId !== null) ids.add(document.sourceDocumentId);
  }
  for (const event of timeline) {
    if (event.sourceDocumentId !== null) ids.add(event.sourceDocumentId);
  }
  return [...ids].sort((a, b) => a - b);
}

/** The place a work sits in, resolved against the boundary manifest. */
async function placeOf(
  project: ProjectSummary,
): Promise<{ readonly state: StateSummary; readonly district: DistrictSummary }> {
  const states = await geography.listStates();
  const state = states.find((s) => s.code === project.stateCode);
  const districts = await geography.listDistricts(project.stateCode);
  const district = districts.find((d) => d.id === project.districtId);
  if (state === undefined || district === undefined) {
    throw new Error(
      `demo data references a place absent from the boundary manifest: ${project.districtId}`,
    );
  }
  return { state, district };
}

function activityFor(companyId: string): CompanyActivity {
  const records = DEMO_PROJECTS.filter((r) => r.project.contractorId === companyId);
  const total = Money.sum(
    records
      .map((r) => r.project.contractValue)
      .filter((f) => f.present)
      .map((f) => Money.fromDecimalString(f.amountInr)),
  );
  return {
    projectCount: records.length,
    totalContractValueInr: total.toDecimalString(),
    stateCodes: [...new Set(records.map((r) => r.project.stateCode))].sort(),
    departmentIds: [...new Set(records.map((r) => r.project.departmentId))].sort(),
  };
}

const projects: ProjectRepository = {
  find(query): Promise<ProjectPage> {
    const all = DEMO_PROJECTS.map((r) => r.project).filter((p) => matches(p, query));
    const limit = query.limit ?? all.length;
    return Promise.resolve({
      projects: all.slice(0, limit),
      matchedCount: all.length,
      datasetVersion: DEMO_DATASET_VERSION,
    });
  },

  async getDossier(projectId): Promise<ProjectDossier | null> {
    const record = DEMO_PROJECTS.find((r) => r.project.id === projectId);
    if (record === undefined) return null;
    const { project } = record;

    const department = DEMO_DEPARTMENTS.find((d) => d.id === project.departmentId);
    if (department === undefined) {
      throw new Error(`demo data references unknown department ${project.departmentId}`);
    }

    const { state, district } = await placeOf(project);

    const contractor =
      project.contractorId === null
        ? null
        : (DEMO_COMPANIES.find((c) => c.id === project.contractorId) ?? null);

    const officers = record.officers.flatMap((association) => {
      const officer = DEMO_OFFICERS.find((o) => o.id === association.officerId);
      return officer === undefined ? [] : [{ officer, association }];
    });

    return {
      project,
      department,
      localBody:
        project.localBodyId === null
          ? null
          : (DEMO_LOCAL_BODIES.find((b) => b.id === project.localBodyId) ?? null),
      district,
      state,
      contractor,
      contractorActivity: contractor === null ? null : activityFor(contractor.id),
      officers,
      tender: record.tender,
      timeline: record.timeline,
      documents: record.documents,
      sources: citedSourceIds(record).flatMap((id) => {
        const source = demoSource(id);
        return source === null ? [] : [source];
      }),
      datasetVersion: DEMO_DATASET_VERSION,
    };
  },
};

const companies: CompanyRepository = {
  get(id): Promise<Company | null> {
    return Promise.resolve(DEMO_COMPANIES.find((c) => c.id === id) ?? null);
  },
  getActivity(id): Promise<CompanyActivity | null> {
    return Promise.resolve(DEMO_COMPANIES.some((c) => c.id === id) ? activityFor(id) : null);
  },
};

type Matcher = (haystack: string) => boolean;

function searchWorks(hit: Matcher): SearchResult[] {
  const results: SearchResult[] = [];
  for (const { project, tender } of DEMO_PROJECTS) {
    if (hit(project.name) || hit(project.externalId)) {
      results.push({
        kind: "project",
        id: project.id,
        title: project.name,
        subtitle: project.externalId,
        target: { type: "project", projectId: project.id },
      });
    }
    if (tender !== null && hit(tender.externalId)) {
      results.push({
        kind: "tender",
        id: tender.id,
        title: tender.externalId,
        subtitle: `Tender · ${project.name}`,
        target: { type: "project", projectId: project.id },
      });
    }
  }
  return results;
}

function searchOrganisations(hit: Matcher): SearchResult[] {
  const firms: SearchResult[] = DEMO_COMPANIES.filter((c) => hit(c.name) || hit(c.id)).map((c) => ({
    kind: "company",
    id: c.id,
    title: c.name,
    subtitle: `Firm · ${c.id}`,
    target: { type: "route", href: `/company/${c.id}` },
  }));
  const bodies: SearchResult[] = DEMO_DEPARTMENTS.filter((d) => hit(d.name)).map((d) => ({
    kind: "department",
    id: d.id,
    title: d.name,
    subtitle: `${d.tier} government body`,
    target: { type: "route", href: `/department/${d.id}` },
  }));
  return [...firms, ...bodies];
}

/**
 * Districts are searched only within the states the demo holds works for.
 * Scanning all 700 districts on every keystroke is the kind of shortcut that
 * works at demo scale and has to be deleted at real scale; the endpoint this
 * stands in for will index them server-side.
 */
const SEARCHABLE_DISTRICT_STATES: readonly string[] = ["27", "23"];

async function searchPlaces(hit: Matcher): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  for (const state of await geography.listStates()) {
    if (hit(state.name)) {
      results.push({
        kind: "place",
        id: state.code,
        title: state.name,
        subtitle: `State · ${String(state.districtCount)} districts`,
        target: { type: "place", stateCode: state.code, districtId: null },
      });
    }
    if (!SEARCHABLE_DISTRICT_STATES.includes(state.code)) continue;
    for (const district of await geography.listDistricts(state.code)) {
      if (hit(district.name)) {
        results.push({
          kind: "place",
          id: district.id,
          title: district.name,
          subtitle: `District · ${state.name}`,
          target: { type: "place", stateCode: state.code, districtId: district.id },
        });
      }
    }
  }
  return results;
}

const search: SearchRepository = {
  async search(term): Promise<readonly SearchResult[]> {
    const needle = term.trim().toLowerCase();
    if (needle.length < 2) return [];
    const hit: Matcher = (haystack) => haystack.toLowerCase().includes(needle);

    return [...searchWorks(hit), ...searchOrganisations(hit), ...(await searchPlaces(hit))].slice(
      0,
      25,
    );
  },
};

export const demoRepositories: Repositories = {
  geography,
  government,
  projects,
  companies,
  search,
};
