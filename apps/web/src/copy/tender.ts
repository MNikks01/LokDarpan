import type {
  FieldValue,
  MissingReason,
  TenderFieldKey,
  TenderSectionKey,
  TenderStatus,
} from "@lokdarpan/domain";
import { formatAmount } from "@lokdarpan/money";

import { longDate } from "./home";

/**
 * Everything a person reads about one tender (ADR-079), in plain words.
 *
 * Written for someone who has never seen a tender notice: what the work is,
 * where, who issued it, how much it may cost and by when. Every empty field
 * says why it is empty, in one short sentence, because a blank invites the
 * reader to guess and the guess is usually "hidden". Kept here for rule B
 * (ADR-059) and the neutrality gate.
 */

const SECTION: Readonly<Record<TenderSectionKey, string>> = {
  what: "What is being built or bought",
  where: "Where",
  who: "Who issued it, and who won",
  money: "How much money",
  when: "When",
};

const FIELD: Readonly<Record<TenderFieldKey, string>> = {
  title: "Title",
  workDescription: "What the work is",
  tenderCategory: "Kind of tender",
  workCategory: "Kind of work",
  tenderType: "How bids are invited",
  contractForm: "Form of contract",
  officeDistrict: "District of the issuing office",
  statedLocation: "Location given on the tender",
  pincode: "Pincode",
  workSite: "Exact work site",
  department: "Department",
  issuingOffice: "Issuing office",
  bidders: "Who bid",
  winner: "Who won",
  estimatedValue: "Estimated cost",
  bidSecurity: "Bid security (EMD)",
  tenderFee: "Tender fee",
  winningBid: "Winning bid",
  contractValue: "Contract value",
  amountPaid: "Money paid so far",
  published: "Published",
  documentsAvailable: "Documents can be downloaded",
  preBidMeeting: "Pre-bid meeting",
  bidsClose: "Last day to submit bids",
  bidsOpen: "Bids are opened",
  periodOfWork: "Time allowed for the work (days)",
  workProgress: "Progress of the work",
};

const MISSING: Readonly<Record<MissingReason, string>> = {
  not_on_page: "Not stated on the tender.",
  detail_not_read: "The tender's full page has not been read yet.",
  award_not_collected:
    "The portals show who bid and who won only behind a CAPTCHA, so LokDarpan does not collect it.",
  site_not_stated:
    "Tenders name the office that issued them, not usually the exact site. Where the description names a road or a stretch of it, that is shown above.",
  progress_not_available:
    "No public record of payments or progress that may be shared has been found yet.",
  district_not_established: "LokDarpan could not work out which district the issuing office is in.",
};

/** How a district was worked out, said so it is never read as the tender's own words. */
const DISTRICT_METHOD: Readonly<Record<string, string>> = {
  chain_unit: "named in the issuing office's own chain",
  office_code: "read from an office's name, which may cover more than one district",
  location_district: "named in the tender's location",
  pincode: "worked out from the office's pincode",
  place_name: "worked out from a post office name",
  manual: "placed by a reviewer",
};

/** A date and time as a reader in India says it: 14 October 2026, 4:00 pm. */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  const time = d
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    .toLowerCase();
  return `${longDate(iso)}, ${time}`;
}

/** "in 5 days", "tomorrow", "today": how far off a deadline is, in words. */
export function untilText(iso: string, now: Date): string {
  const day = (t: Date): number =>
    Math.floor(
      new Date(t.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })).getTime() / 86_400_000,
    );
  const days = day(new Date(iso)) - day(now);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${String(days)} days`;
}

/** An amount the short way people say it, with the exact figure beside it. */
export function rupeesText(inr: string): string {
  const short = formatAmount(inr, "en", "crore-lakh");
  const full = formatAmount(inr, "en", "full");
  return short === full ? full : `${short} (${full})`;
}

function valueText(value: FieldValue): string {
  switch (value.kind) {
    case "text":
    case "as_printed":
      return value.text;
    case "rupees":
      return rupeesText(value.inr);
    case "date":
      return dateTime(value.iso);
    case "chain":
      return value.offices.join(" › ");
    case "office_district":
      return `${value.name} (${DISTRICT_METHOD[value.method] ?? "worked out by LokDarpan"})`;
  }
}

export const tenderCopy = {
  section: (key: TenderSectionKey): string => SECTION[key],
  field: (key: TenderFieldKey): string => FIELD[key],
  missing: (why: MissingReason): string => MISSING[why],
  value: valueText,
  /** Lead-in for a section's missing fields: "Not available: Who bid, Who won." */
  notAvailable: (labels: readonly string[]): string => `Not available: ${labels.join(", ")}.`,

  status: (status: TenderStatus, now: Date): string => {
    switch (status.kind) {
      case "open":
        return `Open · bids close ${dateTime(status.closesAt)}, ${untilText(status.closesAt, now)}`;
      case "closed":
        return `Bids closed on ${longDate(status.closedAt)}. Whether it was awarded is not known.`;
      case "unknown":
        return "The closing date is not stated.";
    }
  },

  quickFacts: "At a glance",
  reference: (ref: string): string => `Reference ${ref}`,
  openOriginal: "Open the original tender on the portal",
  seen: (first: string, last: string): string =>
    `LokDarpan first saw this tender on ${longDate(first)} and last checked it on ${longDate(last)}.`,
  changes: (n: number): string =>
    n === 0
      ? "No change has been recorded since it was first seen."
      : `${String(n)} earlier ${n === 1 ? "version is" : "versions are"} kept, such as a deadline the office moved.`,
  officeNotSite: "The district shown is where the issuing office is. The work may be elsewhere.",

  withheld:
    "LokDarpan holds this tender, but its details are not shown: the portal's terms allow republishing them only with the issuing department's permission, which has not been given yet.",
  withheldLink: "Read this tender on the state's portal",
  unavailable:
    "This tender could not be loaded just now. This is a fault here, not a statement about the tender.",
} as const;

export const tenderPageCopy = {
  withheldTitle: "A tender held by LokDarpan — details not shown",
} as const;
