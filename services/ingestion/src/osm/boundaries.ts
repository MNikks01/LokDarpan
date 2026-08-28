/**
 * OpenStreetMap administrative boundaries, as this ledger will accept them.
 *
 * Pure: no network, no database. Everything here is parsing and validation of
 * a payload we did not write, which `.docs/12-security` requires be treated as
 * untrusted — a relation can carry any tags anyone typed, and a member way can
 * carry coordinates that are absent, reversed, or off the planet.
 *
 * WHY OSM AT ALL
 * The Local Government Directory is the authoritative registry and it gates
 * district-and-below views behind a CAPTCHA, so the units inside a district do
 * not reach us from it. OSM publishes them under ODbL with attribution. That
 * makes it usable and NOT authoritative, which is a distinction the boundary's
 * `source_kind` carries all the way to the reader.
 */

/** Indian admin levels, as OSM actually tags them — verified, not assumed. */
export const OSM_ADMIN_LEVEL: Readonly<Record<number, string>> = {
  2: "country",
  4: "state",
  5: "district",
  6: "sub_district",
  7: "block",
  8: "urban_local_body",
  9: "village",
  10: "ward",
};

/**
 * The ledger level an OSM admin_level maps to.
 *
 * The mapping is by country convention, not a global truth: OSM's admin_level
 * means different things in different countries, and in Maharashtra level 5 is
 * the district and level 6 the taluka. Anything outside the table is refused
 * rather than guessed into the nearest level.
 */
export function levelFor(adminLevel: number): string | null {
  return OSM_ADMIN_LEVEL[adminLevel] ?? null;
}

export type OverpassTags = Readonly<Record<string, string | undefined>>;

export interface OverpassRelation {
  readonly type: string;
  readonly id: number;
  readonly tags?: OverpassTags;
  readonly members?: readonly {
    readonly type: string;
    readonly role?: string;
    readonly geometry?: readonly { readonly lat: number; readonly lon: number }[];
  }[];
}

export interface ParsedUnit {
  readonly osmRelationId: number;
  readonly name: string;
  readonly level: string;
  readonly osmAdminLevel: number;
  /** From `ref:LGD:*` when the relation carries one. Never synthesised. */
  readonly lgdCode: string | null;
  /** Which `ref:LGD:*` key supplied the code, so the registry is named. */
  readonly lgdCodeKind: string | null;
  /** Closed rings in WGS84, outer and inner, as `[lng, lat]` pairs. */
  readonly rings: readonly (readonly (readonly [number, number])[])[];
}

export class BoundaryRejected extends Error {
  constructor(
    readonly osmRelationId: number,
    readonly reason: string,
  ) {
    super(`relation ${String(osmRelationId)} rejected: ${reason}`);
    this.name = "BoundaryRejected";
  }
}

/** India's bounding box, generously padded. A boundary outside it is a defect. */
const INDIA = { west: 67, south: 5, east: 99, north: 38 } as const;

function isPlausible(lon: number, lat: number): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= INDIA.west &&
    lon <= INDIA.east &&
    lat >= INDIA.south &&
    lat <= INDIA.north
  );
}

/**
 * The LGD code a relation carries, if any.
 *
 * Returned with the key that supplied it, because `ref:LGD:district` and
 * `ref:LGD:subdistrict` are codes in different registries and a bare number
 * that does not say which one is a join waiting to go wrong. Nagpur is 484 as
 * an LGD district and 505 as a Census district; both are "the district code".
 */
export function lgdReference(tags: OverpassTags): { code: string; kind: string } | null {
  for (const [key, value] of Object.entries(tags)) {
    if (!key.toLowerCase().startsWith("ref:lgd")) continue;
    if (value === undefined || !/^\d+$/.test(value.trim())) continue;
    return { code: value.trim(), kind: key };
  }
  return null;
}

/**
 * Assemble a relation's member ways into closed rings.
 *
 * Overpass `out geom` returns each member way's coordinates but not the order
 * they connect in, so ways are chained end-to-end until a ring closes. A
 * relation whose linework does not close is refused: a boundary with a gap is
 * not a boundary, and silently closing it would invent the missing edge.
 */
export function assembleRings(
  relation: OverpassRelation,
): readonly (readonly (readonly [number, number])[])[] {
  const remaining = memberLines(relation);
  if (remaining.length === 0)
    throw new BoundaryRejected(relation.id, "no member ways with geometry");

  const rings: (readonly [number, number])[][] = [];
  while (remaining.length > 0) {
    const seed = remaining.shift();
    if (seed === undefined) break;
    rings.push(closeRing(relation.id, seed, remaining));
  }
  return rings;
}

/** Member ways that carry usable geometry, as open polylines. */
function memberLines(relation: OverpassRelation): [number, number][][] {
  const lines: [number, number][][] = [];
  for (const member of relation.members ?? []) {
    if (member.type !== "way" || member.geometry === undefined) continue;
    if (member.role !== undefined && member.role !== "outer" && member.role !== "inner") continue;
    const line = member.geometry.map((p) => [p.lon, p.lat] as [number, number]);
    if (line.length >= 2) lines.push(line);
  }
  return lines;
}

/**
 * Chain ways onto a seed until the ring closes, consuming them from `remaining`.
 *
 * Refuses rather than closing a gap itself: an invented edge is geometry no
 * source drew.
 */
function closeRing(
  relationId: number,
  seed: [number, number][],
  remaining: [number, number][][],
): [number, number][] {
  let current = seed;
  let joined = true;
  while (joined && !isClosed(current)) {
    joined = false;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (candidate === undefined) continue;
      const attached = attach(current, candidate);
      if (attached === null) continue;
      current = attached;
      remaining.splice(i, 1);
      joined = true;
      break;
    }
  }
  if (!isClosed(current)) {
    throw new BoundaryRejected(relationId, "member ways do not close into a ring");
  }
  if (current.length < 4) throw new BoundaryRejected(relationId, "ring has fewer than 3 points");
  return current;
}

function same(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function isClosed(line: readonly (readonly [number, number])[]): boolean {
  const first = line[0];
  const last = line[line.length - 1];
  return first !== undefined && last !== undefined && line.length > 2 && same(first, last);
}

/** Chain `candidate` onto `line` at either end, in either direction. */
function attach(
  line: [number, number][],
  candidate: readonly (readonly [number, number])[],
): [number, number][] | null {
  const start = line[0];
  const end = line[line.length - 1];
  const cStart = candidate[0];
  const cEnd = candidate[candidate.length - 1];
  if (start === undefined || end === undefined || cStart === undefined || cEnd === undefined) {
    return null;
  }
  const forward = candidate.map((p) => [p[0], p[1]] as [number, number]);
  const backward = [...forward].reverse();

  if (same(end, cStart)) return [...line, ...forward.slice(1)];
  if (same(end, cEnd)) return [...line, ...backward.slice(1)];
  if (same(start, cEnd)) return [...forward.slice(0, -1), ...line];
  if (same(start, cStart)) return [...backward.slice(0, -1), ...line];
  return null;
}

/**
 * Validate one relation into something the ledger can store, or refuse it.
 *
 * Every rejection names its reason so an ingestion run reports what it declined
 * and why, rather than quietly holding fewer boundaries than the operator
 * believes.
 */
export function parseRelation(relation: OverpassRelation): ParsedUnit {
  const tags = relation.tags ?? {};
  const name = requiredName(relation.id, tags);
  const adminLevel = requiredAdminLevel(relation.id, tags);
  const level = levelFor(adminLevel);
  if (level === null) {
    throw new BoundaryRejected(
      relation.id,
      `admin_level ${String(adminLevel)} has no ledger level`,
    );
  }

  const rings = assembleRings(relation);
  assertWithinIndia(relation.id, rings);

  const reference = lgdReference(tags);
  return {
    osmRelationId: relation.id,
    name,
    level,
    osmAdminLevel: adminLevel,
    lgdCode: reference?.code ?? null,
    lgdCodeKind: reference?.kind ?? null,
    rings,
  };
}

function requiredName(relationId: number, tags: OverpassTags): string {
  const name = tags["name"]?.trim();
  if (name === undefined || name === "") throw new BoundaryRejected(relationId, "no name tag");
  return name;
}

function requiredAdminLevel(relationId: number, tags: OverpassTags): number {
  const raw = tags["admin_level"];
  const adminLevel = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isInteger(adminLevel)) {
    throw new BoundaryRejected(relationId, `admin_level is not an integer: ${raw ?? "absent"}`);
  }
  return adminLevel;
}

/**
 * A boundary outside India is a defect in the payload, not a place. Overpass
 * returns what the query matched, and a mis-tagged relation elsewhere on the
 * planet would otherwise be stored as an Indian administrative unit.
 */
function assertWithinIndia(
  relationId: number,
  rings: readonly (readonly (readonly [number, number])[])[],
): void {
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (!isPlausible(lon, lat)) {
        throw new BoundaryRejected(
          relationId,
          `coordinate outside India: ${String(lon)},${String(lat)}`,
        );
      }
    }
  }
}

export interface ParseOutcome {
  readonly units: readonly ParsedUnit[];
  readonly rejected: readonly { readonly osmRelationId: number; readonly reason: string }[];
}

/** Parse a whole Overpass response, keeping what is usable and reporting the rest. */
export function parseRelations(elements: readonly OverpassRelation[]): ParseOutcome {
  const units: ParsedUnit[] = [];
  const rejected: { osmRelationId: number; reason: string }[] = [];
  for (const element of elements) {
    if (element.type !== "relation") continue;
    try {
      units.push(parseRelation(element));
    } catch (error: unknown) {
      rejected.push({
        osmRelationId: element.id,
        reason: error instanceof BoundaryRejected ? error.reason : "unparseable",
      });
    }
  }
  return { units, rejected };
}
