/**
 * Which sources may be shown to a reader, and which may only be held.
 *
 * The sources this project uses do not carry the same terms, and the
 * difference is not cosmetic:
 *
 * - **CAG**, **LGD** and **OpenStreetMap** permit reproduction outright, with
 *   attribution and no permission needed.
 * - **BEAMS** — the Maharashtra treasury system — and the **GePNIC** tender
 *   portals permit reproduction only after permission is obtained. None has
 *   been sought (`.docs/decisions/2026-10-07-permissions-deferred.md`), so their
 *   figures and details are not published.
 *
 * See `.docs/06-government-sources/source-licences.md` for the clauses, each
 * fetched and quoted rather than summarised.
 *
 * **This withholds display, not collection.** BEAMS is still ingested, and its
 * figures are still what the consistency checks compare a CAG figure against —
 * a comparison a reader never sees is still a comparison that catches an error.
 * What is withheld is the rendering.
 *
 * **What opens a restricted source.** `publicationDecision` in
 * `@lokdarpan/domain` decides, from the publisher's terms, a grant recorded in
 * `PERMISSION_GRANTS`, and an operator's switch read here. A switch without a
 * recorded grant opens nothing, so no deployment can publish a restricted source
 * by setting a variable (ADR-073).
 */

import {
  PERMISSION_GRANTS,
  publicationDecision,
  type PermissionGrant,
  type PublicationDecision,
} from "@lokdarpan/domain";

/**
 * The switches an operator may set, by registry id.
 *
 * `PUBLISH_RESTRICTED_SOURCES` takes a comma-separated list of registry ids
 * (`beams,gepnic`), so a newly granted source needs no new variable. The two
 * older per-source flags are still honoured, because runbooks and deployment
 * settings name them.
 */
const LEGACY_SWITCHES: Readonly<Record<string, string>> = {
  PUBLISH_BEAMS_FIGURES: "beams",
  PUBLISH_TENDER_DETAILS: "gepnic",
};

/**
 * Registry ids switched on in this environment.
 *
 * Read at call time, never frozen at import: the day a grant is recorded and
 * the switch set, a source opens without a rebuild. Only the exact string
 * "true" sets a per-source flag; a truthiness test would let "false" through.
 */
export function switchedOnSources(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ReadonlySet<string> {
  const on = new Set<string>();
  for (const [name, sourceId] of Object.entries(LEGACY_SWITCHES)) {
    if (env[name] === "true") on.add(sourceId);
  }
  for (const id of (env["PUBLISH_RESTRICTED_SOURCES"] ?? "").split(",")) {
    const trimmed = id.trim();
    if (trimmed !== "") on.add(trimmed);
  }
  return on;
}

/**
 * Whether this deployment is the operator's private preview (ADR-078).
 *
 * A preview shows withheld material so the operator can see the product with
 * real data before any permission arrives. Showing it to themselves is review,
 * not republication; showing it to anyone else would be. So it opens only where
 * nobody else can look, and never where the public can:
 *
 * - never on Vercel's production environment, whatever else is set;
 * - never in a production build outside Vercel, which is a self-hosted
 *   production site by another name;
 * - otherwise only when `LOKDARPAN_INTERNAL_PREVIEW` is exactly "true": a local
 *   `next dev`, or a Vercel preview deployment, which Vercel Authentication
 *   restricts to the project's members.
 */
export function internalPreview(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (env["VERCEL_ENV"] === "production") return false;
  if (env["NODE_ENV"] === "production" && env["VERCEL_ENV"] !== "preview") return false;
  return env["LOKDARPAN_INTERNAL_PREVIEW"] === "true";
}

/** The decision for a source in this environment, with its basis or reason. */
export function decideFor(
  sourceId: string,
  options: { readonly issuer?: string | null; readonly grants?: readonly PermissionGrant[] } = {},
): PublicationDecision {
  const decision = publicationDecision(sourceId, {
    switchedOn: switchedOnSources(),
    issuer: options.issuer ?? null,
    grants: options.grants ?? PERMISSION_GRANTS,
  });
  if (!decision.publishable && internalPreview()) {
    return { publishable: true, basis: "internal_preview" };
  }
  return decision;
}

/**
 * Whether the treasury figures may be rendered.
 *
 * Off unless a grant is recorded for BEAMS and an operator has switched it on.
 */
export function treasuryFiguresArePublishable(
  grants: readonly PermissionGrant[] = PERMISSION_GRANTS,
): boolean {
  return decideFor("beams", { grants }).publishable;
}

/**
 * Whether tender details may be rendered across all portals: titles,
 * references, values, EMDs, organisation chains and locations.
 *
 * Every GePNIC portal we collect permits reproduction "after taking proper
 * permission from the respective Organisation / Department" (Madhya Pradesh: in
 * writing), the clause BEAMS is withheld under. Until permission is granted the
 * reader is linked to the state's portal, which the same terms allow without
 * asking (`source-licences.md` §5, ADR-056).
 *
 * This answers for every tender at once, so only a grant covering the whole
 * source opens it. A grant limited to one issuing department is honoured by
 * `decideFor("gepnic", { issuer })` on that department's rows.
 *
 * Counts and district shading stay: they are computed by LokDarpan, not
 * reproduced from a portal.
 */
export function tenderDetailsArePublishable(
  grants: readonly PermissionGrant[] = PERMISSION_GRANTS,
): boolean {
  return decideFor("gepnic", { grants }).publishable;
}
