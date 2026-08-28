import { createHash } from "node:crypto";

/**
 * The Overpass client.
 *
 * Kept apart from parsing so the parser can be tested without a network, and
 * so the one place that talks to a third party is the one place that has to
 * think about rate limits, timeouts and attribution.
 *
 * OVERPASS IS A SHARED VOLUNTEER SERVICE. Queries are scoped to one district at
 * a time and the response is stored as a content-addressed artefact, so a
 * re-run of the loader does not re-query. Ingesting a state should be a loop
 * over districts with the artefacts kept, not one enormous query.
 */

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_LICENCE = "Open Database License (ODbL) 1.0";

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";

export interface OverpassResponse {
  readonly elements: readonly unknown[];
}

export interface FetchedArtifact {
  readonly body: string;
  readonly sha256: string;
  readonly retrievedAt: string;
  readonly sourceUrl: string;
  readonly byteSize: number;
}

/**
 * Every administrative boundary inside a relation, at any level.
 *
 * `map_to_area` turns the relation into a search area; the second statement
 * then finds the boundaries within it. `out geom` returns member way
 * coordinates, which is what ring assembly needs — `out tags` alone would give
 * names with no geometry.
 */
export function boundariesInRelationQuery(
  relationId: number,
  adminLevels: readonly number[] = [],
): string {
  // Without a level filter this returns every village too. Maharashtra has tens
  // of thousands; asking a shared volunteer service for all of them to display
  // 36 districts is both slow and rude.
  const levelFilter =
    adminLevels.length === 0
      ? ""
      : `["admin_level"~"^(${adminLevels.map((l) => String(l)).join("|")})$"]`;
  return [
    "[out:json][timeout:240];",
    `rel(${String(relationId)});map_to_area->.searchArea;`,
    `rel(area.searchArea)["boundary"="administrative"]${levelFilter};`,
    "out geom;",
  ].join("\n");
}

/** A named boundary relation, used to find a district before descending into it. */
export function findRelationQuery(name: string, adminLevel: number): string {
  const safe = name.replace(/["\\]/g, "");
  return [
    "[out:json][timeout:120];",
    `rel["boundary"="administrative"]["admin_level"="${String(adminLevel)}"]["name"="${safe}"];`,
    "out tags;",
  ].join("\n");
}

export async function runQuery(
  query: string,
  endpoint = DEFAULT_ENDPOINT,
): Promise<FetchedArtifact> {
  const retrievedAt = new Date().toISOString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      // Overpass asks clients to identify themselves so abuse can be traced to
      // a project rather than an anonymous IP.
      "user-agent":
        "LokDarpan/0.1 (public-infrastructure transparency; +https://github.com/MNikks01/LokDarpan)",
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Overpass rate-limited this client (429). Wait before retrying; do not loop."
        : `Overpass returned ${String(response.status)}`,
    );
  }

  const body = await response.text();
  return {
    body,
    sha256: createHash("sha256").update(body).digest("hex"),
    retrievedAt,
    sourceUrl: endpoint,
    byteSize: Buffer.byteLength(body),
  };
}

/** Parse a fetched artefact, failing loudly rather than half-reading it. */
export function readElements(artifact: FetchedArtifact): readonly unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(artifact.body);
  } catch {
    throw new Error("Overpass response was not JSON. Nothing loaded.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as OverpassResponse).elements)
  ) {
    throw new Error("Overpass response had no `elements` array. Nothing loaded.");
  }
  return (parsed as OverpassResponse).elements;
}
