import { describeSources, levelCoverageState } from "@lokdarpan/domain";
import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * Everything the explorer draws for the level inside a place, in one snapshot.
 *
 * The units, their boundaries and what is known about how complete they are
 * used to be two requests. Each named its own dataset version, and a load
 * committing between them could put a unit in the list with no shape on the
 * map, or a shape on the map missing from the list. Read together, they
 * describe one state of the ledger and carry one version (ADR-064).
 *
 * The caller does not say what it expects to find. A district may contain
 * talukas, municipal bodies and villages at once — Nagpur contains all three —
 * so the hierarchy is read from the data rather than assumed by the client.
 *
 * `coverage` travels with the list because it is what the list means. Pune holds
 * 14 talukas and no municipal body, and Pune Municipal Corporation plainly
 * exists — so the units alone say "here is what we hold" and get read as "here
 * is what there is".
 *
 * Boundaries are simplified in PostGIS on the way out. The place's own outline
 * is not included: a state's averages 86 KB and the explorer only draws it once
 * a unit is selected, from `/geo/units/:id`.
 */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const unitId = Number(id);
    return inLedger(async ({ geography }) => {
      if (!Number.isInteger(unitId) || unitId < 1) {
        return {
          units: [],
          coverage: [],
          sources: [],
          boundaries: { type: "FeatureCollection", features: [] },
        };
      }
      // One at a time: every read shares the snapshot's client (ADR-053).
      const units = await geography.childrenOf(unitId);
      const coverage = await geography.coverageIn(unitId);
      const boundaries = await geography.boundariesOfChildren(unitId);
      // Each level's coverage also carries its shared data state (ADR-054).
      const levels = coverage.map((level) => ({ ...level, state: levelCoverageState(level) }));
      return {
        units,
        coverage: levels,
        // The terms each coverage source is held under (ADR-055).
        sources: describeSources(levels.flatMap((level) => level.state.sourceIds)),
        boundaries,
      };
    });
  });
}
