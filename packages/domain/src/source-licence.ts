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
];

export function licenceFor(sourceId: string): SourceLicence | null {
  return LICENCES.find((l) => l.sourceId === sourceId) ?? null;
}

/**
 * Whether a source's material may be shown to a reader.
 *
 * An unrecorded source is refused, not allowed. The two errors are not
 * symmetric: withholding a figure delays a reader, while publishing one we had
 * no right to publish damages the standing this project's entire value rests
 * on. So the default is withheld and silence is never read as consent.
 */
export function mayRepublish(sourceId: string): boolean {
  return licenceFor(sourceId)?.republication === "permitted";
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
