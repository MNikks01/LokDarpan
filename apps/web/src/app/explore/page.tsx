import type React from "react";
import type { Metadata } from "next";
import { GeometryNotInstalledError, demoRepositories } from "@/data/demo-repository";
import { DEMO_COMPANIES } from "@/data/demo/organisations";
import { ExploreShell } from "@/components/explore/ExploreShell";
import { parseExplorerState, toSearchParams, type ExplorerState } from "@/state/explorer-url";
import type { ProjectQuery } from "@/data/repositories";
import { color } from "@/ui/tokens";

export const metadata: Metadata = {
  title: "Explore infrastructure — LokDarpan",
  description:
    "Explore public infrastructure works geographically: state, district, local body, department and individual road, with the contract, procurement and document record behind each one.",
};

/**
 * The explorer is a Server Component that hands a client island its opening
 * data and nothing more.
 *
 * The catalogue values a reader needs before touching anything — states,
 * departments, firms — are rendered on the server, so the first paint is not a
 * set of empty dropdowns waiting on a fetch. Districts, works and the detail
 * payload are fetched per selection, because preloading all 36 states' works
 * would not survive contact with a real dataset.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  let states;
  try {
    states = await demoRepositories.geography.listStates();
  } catch (error: unknown) {
    if (error instanceof GeometryNotInstalledError) return <GeometryMissing error={error} />;
    throw error;
  }

  // The selection is read from the request, so a shared deep link is rendered
  // server-side as the place it names rather than being corrected on the client.
  const initialState = parseExplorerState(toSearchParams(await searchParams));

  const [departments, page] = await Promise.all([
    demoRepositories.government.listDepartments({}),
    demoRepositories.projects.find(queryFor(initialState)),
  ]);

  return (
    <ExploreShell
      states={states}
      departments={departments}
      companies={DEMO_COMPANIES}
      initialProjects={page.projects}
      initialMatchedCount={page.matchedCount}
      initialState={initialState}
    />
  );
}

/** The same narrowing the works endpoint applies, so first paint matches. */
function queryFor(state: ExplorerState): ProjectQuery {
  const { geo, filters } = state;
  return {
    ...(geo.stateCode === null ? {} : { stateCode: geo.stateCode }),
    ...(geo.districtId === null ? {} : { districtId: geo.districtId }),
    ...(geo.localBodyId === null ? {} : { localBodyId: geo.localBodyId }),
    ...(filters.departmentId === null ? {} : { departmentId: filters.departmentId }),
    ...(filters.contractorId === null ? {} : { contractorId: filters.contractorId }),
    infrastructureType: filters.infrastructureType,
    statuses: filters.statuses,
  };
}

/**
 * Boundary geometry is fetched at setup rather than committed, because the
 * upstream dataset declares no licence. When it has not been fetched the page
 * says exactly that and gives the command, instead of rendering a blank map.
 */
function GeometryMissing({
  error,
}: {
  readonly error: GeometryNotInstalledError;
}): React.JSX.Element {
  return (
    <div style={{ maxWidth: "62ch" }}>
      <h1 style={{ fontSize: 22 }}>The map needs its boundary geometry</h1>
      <p style={{ color: color.text.secondary }}>{error.message}</p>
      <pre
        style={{
          background: color.bg.sunken,
          border: `1px solid ${color.border.hair}`,
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
          overflowX: "auto",
        }}
      >
        {error.command}
      </pre>
      <p style={{ fontSize: 13, color: color.text.tertiary }}>
        Administrative boundaries are not committed to this repository: the upstream dataset
        declares no licence, and <code>.docs/17-legal/legal-ethical-rules.md</code> does not permit
        republishing material whose terms have not been established. The command above fetches and
        simplifies it into <code>apps/web/public/geo</code>, which is gitignored.
      </p>
    </div>
  );
}
