import type React from "react";
import type { Metadata } from "next";
import { GeometryNotInstalledError, listStateOptions } from "@/data/geography";
import { ExploreShell } from "@/components/explore/ExploreShell";
import { parseExplorerState, toSearchParams } from "@/state/explorer-url";
import { color } from "@/ui/tokens";

export const metadata: Metadata = {
  title: "Explore official records by place — LokDarpan",
  description:
    "Explore the official records LokDarpan holds, by state and district: audit reports and the facts a person has verified in them, each cited to the page it was read from.",
};

/**
 * The explorer is a Server Component that hands a client island its opening
 * data and nothing more.
 *
 * The states catalogue is rendered on the server so the first paint is not an
 * empty dropdown waiting on a fetch. Districts and records are fetched per
 * selection, because loading every state's records up front would not survive
 * contact with a full ledger.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  let states;
  try {
    states = await listStateOptions();
  } catch (error: unknown) {
    if (error instanceof GeometryNotInstalledError) return <GeometryMissing error={error} />;
    throw error;
  }

  // The selection is read from the request, so a shared deep link is rendered
  // server-side as the place it names rather than being corrected on the client.
  const initialState = parseExplorerState(toSearchParams(await searchParams));

  return <ExploreShell states={states} initialState={initialState} />;
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
    <div style={{ maxWidth: "62ch", margin: "0 auto", padding: 24 }}>
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
