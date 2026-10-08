/**
 * What each source permits us to republish.
 *
 * Distinct from whether we may *collect* it, which `robots.txt` answers and
 * `.docs/06-government-sources/access-and-permissions.md` records. A source can
 * be freely crawlable and still not freely republishable, and only the second
 * question governs what a reader is allowed to see.
 *
 * Every entry is transcribed from a page that was fetched and recorded in
 * `.docs/06-government-sources/source-licences.md`. Nothing here is written
 * from memory, and permission is never inferred from a publisher's silence.
 */

export type Republication =
  /** The publisher's terms permit reproduction with no prior approach. */
  | "permitted"
  /** The terms permit reproduction only after written permission is obtained. */
  | "permission_required"
  /** No terms were located. Not the same as permitted. */
  | "unknown";

export interface SourceLicence {
  readonly sourceId: string;
  readonly republication: Republication;
  /**
   * Who must be credited. Every source examined so far requires the source to
   * be "prominently acknowledged", so this is not optional anywhere.
   */
  readonly attribution: string;
  /** The page the terms were read from, so a reader can check them too. */
  readonly termsUrl: string;
  /** When that page was last fetched, not when this file was last edited. */
  readonly verifiedOn: string;
  /**
   * What is inferred rather than verified. Recorded on the licence itself so
   * the qualification travels with it instead of living only in a document
   * nobody rereads.
   */
  readonly caveat: string | null;
}

const LICENCES: readonly SourceLicence[] = [
  {
    sourceId: "lgd",
    republication: "permitted",
    attribution: "Local Government Directory, Ministry of Panchayati Raj, Government of India",
    termsUrl: "https://lgdirectory.gov.in/copyRightPolicy.do",
    verifiedOn: "2026-08-28",
    caveat: null,
  },
  {
    sourceId: "cag",
    republication: "permitted",
    attribution: "Comptroller and Auditor General of India",
    termsUrl: "https://cag.gov.in/ag/bihar/en/page-ag-bihar-copyright-policy",
    verifiedOn: "2026-08-28",
    caveat:
      "Terms verified on a CAG office site; the main cag.gov.in site, which serves our PDFs, " +
      "states no copyright policy at a separate located URL. The stated content owner is the " +
      "CAG itself rather than the office, so the policy is read as the institution's.",
  },
  {
    // The one that blocks display. Its terms require asking first, which is the
    // opposite of the other two rather than a softer version of them.
    sourceId: "beams",
    republication: "permission_required",
    attribution: "Finance Department, Government of Maharashtra (BEAMS)",
    termsUrl: "https://finance.maharashtra.gov.in/en/website-policies/",
    verifiedOn: "2026-08-28",
    caveat:
      "The policy is published on finance.maharashtra.gov.in; BEAMS is served from " +
      "beams.mahakosh.gov.in, which states no terms of its own. Reading the department's " +
      "policy as governing a department system is an inference, not a verified fact.",
  },
  {
    // The most restrictive terms of any source examined. NRIDA's notice
    // forbids republication outright and confines even downloading to "one
    // copy on a single computer for your personal, non-commercial internal
    // use" - so this is blocked twice over for a public-interest site.
    sourceId: "pmgsy",
    republication: "permission_required",
    attribution:
      "National Rural Infrastructure Development Agency (NRIDA), Ministry of Rural Development",
    termsUrl: "https://pmgsy.dord.gov.in/Home/HomeLegalNotice/",
    verifiedOn: "2026-08-28",
    caveat:
      "Terms are explicit rather than inferred: the Materials 'may not be copied, reproduced, " +
      "modified, published, republished, uploaded, downloaded, posted, transmitted, or " +
      "distributed in any way, without NRIDA's prior written permission'. Unlike BEAMS, this " +
      "restricts collection as well as display.",
  },
  {
    // Every state portal we collect publishes the BEAMS clause. Recorded on
    // 2026-09-17, after tenders from these portals had already been listed on the
    // explorer; see source-licences.md §5 for what that leaves open.
    sourceId: "gepnic",
    republication: "permission_required",
    attribution: "State Government eProcurement portal (GePNIC), for the issuing department",
    termsUrl: "https://etenders.kerala.gov.in/nicgep/app?page=Disclaimer&service=page",
    verifiedOn: "2026-09-17",
    caveat:
      "The same Copyright Policy on all 21 collected portals: material 'maybe reproduced free of " +
      "charge after taking proper permission from the respective Organisation / Department', and " +
      "linking directly needs no prior permission. Madhya Pradesh requires written permission and " +
      "prominent acknowledgement. Permission is per issuing department, not per portal.",
  },
  {
    sourceId: "openstreetmap",
    republication: "permitted",
    attribution: "© OpenStreetMap contributors",
    termsUrl: "https://www.openstreetmap.org/copyright",
    verifiedOn: "2026-09-17",
    caveat:
      "Open Database License: 'If you alter or build upon our data, you may distribute the result " +
      "only under the same license.' The simplified boundaries served here are built upon it.",
  },
];

/**
 * The registry entry a source id is governed by.
 *
 * Collectors are named more narrowly than publishers: `gepnic-kerala` is one
 * portal, and `openstreetmap-overpass` one route into OpenStreetMap. Terms are
 * the publisher's, so an id with no entry of its own falls back to the part
 * before its first hyphen. An id matching neither is unrecorded, and refused.
 */
function registryIdOf(sourceId: string): string {
  if (LICENCES.some((l) => l.sourceId === sourceId)) return sourceId;
  const hyphen = sourceId.indexOf("-");
  return hyphen > 0 ? sourceId.slice(0, hyphen) : sourceId;
}

export function licenceFor(sourceId: string): SourceLicence | null {
  const id = registryIdOf(sourceId);
  return LICENCES.find((l) => l.sourceId === id) ?? null;
}

/**
 * A permission a publisher actually granted, as received.
 *
 * A `permission_required` source stays withheld until one of these exists. It
 * is the only way such a source becomes publishable: the licence entry above
 * keeps stating the publisher's terms, which a grant does not change.
 *
 * Every grant must match an entry in
 * `.docs/06-government-sources/permission-requests.json` whose status is
 * `granted`, with the same reference and date; a test holds the two together.
 */
export interface PermissionGrant {
  /** The registry id the grant covers: `beams`, `gepnic`, `pmgsy`. */
  readonly sourceId: string;
  /**
   * The issuing body the grant is limited to, or `null` for the whole source.
   * GePNIC portals require permission per issuing department, so one
   * department's grant opens only that department's tenders.
   */
  readonly issuer: string | null;
  /** The id of the request in `permission-requests.json`. */
  readonly requestId: string;
  /** When the grant was received, `YYYY-MM-DD`. */
  readonly grantedOn: string;
  /** The grant's own reference: a letter number, an email's date and sender. */
  readonly reference: string;
  /** Conditions the grant states, such as a required attribution. */
  readonly conditions: string | null;
}

/**
 * Grants received. Empty: no request has been sent
 * (`.docs/decisions/2026-10-07-permissions-deferred.md`).
 */
export const PERMISSION_GRANTS: readonly PermissionGrant[] = [];

/** Why a source may be shown. */
export type PublicationBasis =
  /** The publisher's terms permit reproduction without asking. */
  | "terms_permit"
  /** The terms require permission, a grant is recorded, and the source is switched on. */
  | "grant_recorded";

/** Why a source is withheld. */
export type WithheldReason =
  /** No terms are recorded, or the terms found are `unknown`. */
  | "terms_unrecorded"
  /** The terms require permission and no grant covering this material is recorded. */
  | "permission_not_granted"
  /** A grant is recorded, but no operator has switched the source on yet. */
  | "not_switched_on";

export type PublicationDecision =
  | { readonly publishable: true; readonly basis: PublicationBasis }
  | { readonly publishable: false; readonly reason: WithheldReason };

export interface PublicationContext {
  /**
   * Registry ids an operator has switched on. Read from the environment by the
   * server, never decided here: this package does no I/O.
   */
  readonly switchedOn?: ReadonlySet<string>;
  /** The issuing body the material came from, where a grant may be per issuer. */
  readonly issuer?: string | null;
  /** The grants to consult. Defaults to the recorded ones; tests pass their own. */
  readonly grants?: readonly PermissionGrant[];
}

const NOTHING_SWITCHED_ON: ReadonlySet<string> = new Set();

/**
 * Whether a source's material may be shown to a reader, and on what basis.
 *
 * Three recorded facts decide it, and nothing else:
 *
 * 1. the publisher's terms (`LICENCES`);
 * 2. a grant, for a source whose terms require permission (`PERMISSION_GRANTS`);
 * 3. an operator's switch, so a recorded grant goes live when someone decides
 *    it should, and can be withdrawn without a deployment.
 *
 * A switch without a grant opens nothing: the rule that a restricted source is
 * never published without a recorded permission is enforced here rather than
 * left to whoever sets the environment. Enabling a granted source is therefore
 * a matter of data — a grant and a switch — and never of code.
 */
export function publicationDecision(
  sourceId: string,
  context: PublicationContext = {},
): PublicationDecision {
  const licence = licenceFor(sourceId);
  if (licence === null || licence.republication === "unknown") {
    return { publishable: false, reason: "terms_unrecorded" };
  }
  if (licence.republication === "permitted") {
    return { publishable: true, basis: "terms_permit" };
  }

  const grants = context.grants ?? PERMISSION_GRANTS;
  const issuer = context.issuer ?? null;
  const granted = grants.some(
    (g) => g.sourceId === licence.sourceId && (g.issuer === null || g.issuer === issuer),
  );
  if (!granted) return { publishable: false, reason: "permission_not_granted" };

  const switchedOn = context.switchedOn ?? NOTHING_SWITCHED_ON;
  if (!switchedOn.has(licence.sourceId)) return { publishable: false, reason: "not_switched_on" };

  return { publishable: true, basis: "grant_recorded" };
}

/**
 * Whether a source's material may be shown to a reader.
 *
 * An unrecorded source is refused, not allowed. The two errors are not
 * symmetric: withholding a figure delays a reader, while publishing one we had
 * no right to publish damages the standing this project's entire value rests
 * on. So the default is withheld and silence is never read as consent.
 */
export function mayRepublish(sourceId: string, context: PublicationContext = {}): boolean {
  return publicationDecision(sourceId, context).publishable;
}

/**
 * The credit line a source requires.
 *
 * Every source examined requires its source to be "prominently acknowledged",
 * so this returns a string rather than an optional: there is no correct way to
 * render this material without it.
 */
export function attributionFor(sourceId: string): string {
  return licenceFor(sourceId)?.attribution ?? "Source not recorded";
}

/** Sources held back for want of permission, for an operator to act on. */
export function awaitingPermission(): readonly SourceLicence[] {
  return LICENCES.filter((l) => l.republication === "permission_required");
}

/**
 * What a response says about each source it draws on.
 *
 * The map must be able to answer "where did this come from, and on what terms
 * is it shown?" from the payload itself (ADR-055). A descriptor carries the
 * publisher, the terms as recorded, and where they were read, including when
 * those terms do not permit what the page does. It states the record; it does
 * not decide display.
 */
export interface SourceDescriptor {
  /** The id as the collector recorded it, e.g. `gepnic-kerala`. */
  readonly sourceId: string;
  readonly publisher: string;
  /** `unknown` for a source with no recorded terms — never assumed permitted. */
  readonly republication: Republication;
  readonly termsUrl: string | null;
  readonly termsVerifiedOn: string | null;
  readonly caveat: string | null;
}

export function describeSource(sourceId: string): SourceDescriptor {
  const licence = licenceFor(sourceId);
  return {
    sourceId,
    publisher: licence?.attribution ?? "Source not recorded",
    republication: licence?.republication ?? "unknown",
    termsUrl: licence?.termsUrl ?? null,
    termsVerifiedOn: licence?.verifiedOn ?? null,
    caveat: licence?.caveat ?? null,
  };
}

/** One descriptor per distinct source id, in first-seen order. */
export function describeSources(sourceIds: readonly string[]): readonly SourceDescriptor[] {
  return [...new Set(sourceIds)].map(describeSource);
}

/**
 * Every source whose terms are recorded, in registry order.
 *
 * For the methodology page, which lists each source from this registry rather
 * than from its own copy of it, so the two cannot drift: a source added here
 * without a methodology entry fails a test.
 */
export function sourceLicences(): readonly SourceLicence[] {
  return LICENCES;
}
