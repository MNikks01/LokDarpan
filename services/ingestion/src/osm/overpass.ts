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

/**
 * Overpass asks clients to identify themselves so abuse can be traced to a
 * project rather than an anonymous IP.
 */
const USER_AGENT =
  "LokDarpan/0.1 (public-infrastructure transparency; +https://github.com/MNikks01/LokDarpan)";

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

/**
 * Overpass did not serve this query, and the reason is about the service rather
 * than about the query being wrong.
 *
 * A distinct type because the caller's response differs entirely: these are not
 * broken queries, re-sending one immediately is the thing that must not happen,
 * and one district the service will not serve must not end a state. Anything
 * else from Overpass is a fault to report.
 */
export class OverpassDeclined extends Error {}

/** No slot free right now. */
export class OverpassRateLimited extends OverpassDeclined {
  constructor() {
    super("Overpass rate-limited this client (429). Wait for a slot; do not loop.");
    this.name = "OverpassRateLimited";
  }
}

/**
 * The service failed to produce an answer — a gateway timeout, or an error at
 * its end.
 *
 * Chandrapur is the case that added this: a large district whose two-level
 * query times out at the gateway with a 504, twice in a row, taking the
 * remaining 28 districts of Maharashtra with it. Whether that query can ever
 * succeed is a separate question from whether one district may end a state.
 */
export class OverpassUnavailable extends OverpassDeclined {
  constructor(readonly status: number) {
    super(`Overpass returned ${String(status)}; the query was not served.`);
    this.name = "OverpassUnavailable";
  }
}

/**
 * How long to wait before asking Overpass for anything, read from its own
 * status page.
 *
 * Overpass publishes the number of free slots and, when there are none, when
 * the next one frees. Guessing a delay instead is what got this client a 429
 * after eight districts at ten seconds apart: the limit is not a rate but a
 * small number of concurrent slots, and a heavy `out geom` query holds one for
 * as long as it runs. Asking is both more polite and more reliable than any
 * interval that could be chosen here.
 *
 * Returns 0 when a slot is free. Kept pure so the parsing is tested without a
 * network — the text is the contract, and it has no version number.
 */
export function slotDelayMs(status: string): number {
  const free = /(\d+)\s+slots? available now/u.exec(status);
  if (free !== null && Number(free[1]) > 0) return 0;

  // "Slot available after: 2026-09-05T07:50:12Z, in 39 seconds." — one line per
  // slot. The soonest is the one worth waiting for.
  const waits = [...status.matchAll(/in\s+(-?\d+)\s+seconds?/gu)].map((m) => Number(m[1]));
  if (waits.length > 0) {
    // A negative figure means the slot came free while the page was being read.
    const soonest = Math.max(0, Math.min(...waits));
    return (soonest + 1) * 1_000;
  }

  // An unrecognised status page is not permission to proceed at speed.
  return 60_000;
}

/**
 * Blocks until Overpass says a slot is free.
 *
 * A status page that cannot be read does not stop the run — it falls back to
 * waiting the same conservative interval an unparseable page implies, because
 * refusing to query at all would make this client depend on a second endpoint
 * being up to use the first.
 */
export async function waitForSlot(
  endpoint = DEFAULT_ENDPOINT,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((done) => {
      setTimeout(done, ms);
    }),
  attempts = 6,
): Promise<void> {
  const statusUrl = new URL("/api/status", endpoint).toString();
  for (let attempt = 0; attempt < attempts; attempt++) {
    let delay: number;
    try {
      const response = await fetch(statusUrl, { headers: { "user-agent": USER_AGENT } });
      delay = response.ok ? slotDelayMs(await response.text()) : 60_000;
    } catch {
      delay = 60_000;
    }
    if (delay === 0) return;
    await sleep(delay);
  }
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
      "user-agent": USER_AGENT,
    },
    body: query,
  });

  if (!response.ok) {
    if (response.status === 429) throw new OverpassRateLimited();
    if (response.status >= 500) throw new OverpassUnavailable(response.status);
    throw new Error(`Overpass returned ${String(response.status)}`);
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
