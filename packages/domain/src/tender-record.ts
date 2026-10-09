/**
 * Everything LokDarpan holds about one tender, arranged around the questions a
 * person asks of it (ADR-079): what is being built, where, who issued it and
 * who won it, how much money, and when.
 *
 * Every field is either known — with where it came from — or missing, with the
 * reason it is missing. A missing field is never a blank: "not on the page",
 * "the portal shows awards only behind a CAPTCHA" and "the tender does not say
 * where the work is" are different facts about the record, and a reader who
 * sees an empty box cannot tell them apart.
 *
 * Pure: the sentences a reader sees are in `apps/web/src/copy/tender.ts`.
 */

export type TenderSectionKey = "what" | "where" | "who" | "money" | "when";

export type TenderFieldKey =
  // What is being built or maintained
  | "title"
  | "workDescription"
  | "tenderCategory"
  | "workCategory"
  | "tenderType"
  | "contractForm"
  // Where
  | "officeDistrict"
  | "statedLocation"
  | "pincode"
  | "workSite"
  // Who
  | "department"
  | "issuingOffice"
  | "bidders"
  | "winner"
  // How much
  | "estimatedValue"
  | "bidSecurity"
  | "tenderFee"
  | "winningBid"
  | "contractValue"
  | "amountPaid"
  // When
  | "published"
  | "documentsAvailable"
  | "preBidMeeting"
  | "bidsClose"
  | "bidsOpen"
  | "periodOfWork"
  | "workProgress";

/** How a known value is to be read. Amounts are decimal rupees as strings, never numbers. */
export type FieldValue =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "rupees"; readonly inr: string }
  | { readonly kind: "date"; readonly iso: string }
  /** A date or amount as the portal printed it, not re-read: shown exactly. */
  | { readonly kind: "as_printed"; readonly text: string }
  | { readonly kind: "chain"; readonly offices: readonly string[] }
  /** A district LokDarpan worked out, and how. Never shown as the tender's own statement. */
  | {
      readonly kind: "office_district";
      readonly name: string;
      readonly method: string;
      readonly evidence: string | null;
      readonly confidence: number | null;
    };

/** Why a field is empty. Each is a different fact about the record. */
export type MissingReason =
  /** The portal's page for this tender does not state it. */
  | "not_on_page"
  /** The detail page has not been read yet for this tender. */
  | "detail_not_read"
  /** Award results are behind a CAPTCHA on every portal tested, so they are not collected. */
  | "award_not_collected"
  /** Tenders state the office that issued them, not usually where the work is. */
  | "site_not_stated"
  /** No register of works progress that may be copied has been found. */
  | "progress_not_available"
  /** No district could be established for the issuing office. */
  | "district_not_established";

export type FieldState =
  | { readonly state: "known"; readonly value: FieldValue }
  | { readonly state: "missing"; readonly why: MissingReason };

export interface TenderField {
  readonly key: TenderFieldKey;
  readonly value: FieldState;
}

export interface TenderSection {
  readonly key: TenderSectionKey;
  readonly fields: readonly TenderField[];
}

/**
 * Where a tender stands, from its dates alone. Never "awarded": nothing
 * collected says whether a tender was awarded, and a passed deadline is not
 * an award (the rule the tender model states first).
 */
export type TenderStatus =
  | { readonly kind: "open"; readonly closesAt: string }
  | { readonly kind: "closed"; readonly closedAt: string }
  | { readonly kind: "unknown" };

export interface TenderRecord {
  readonly id: number;
  readonly title: string;
  readonly reference: string;
  readonly status: TenderStatus;
  readonly sections: readonly TenderSection[];
  readonly source: {
    readonly portalCode: string;
    readonly url: string;
    /** When LokDarpan first and last saw the tender on the portal. */
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
  };
  /** How many earlier readings are kept, such as a deadline the office extended. */
  readonly changes: number;
}

/** What the ledger holds for one tender, as the record is built from. */
export interface TenderRecordInput {
  readonly id: number;
  readonly portalCode: string;
  readonly title: string;
  readonly reference: string;
  readonly department: string | null;
  readonly organisationChain: string | null;
  readonly location: string | null;
  readonly pincode: string | null;
  readonly tenderCategory: string | null;
  readonly productCategory: string | null;
  readonly tenderType: string | null;
  readonly tenderValueInr: string | null;
  readonly emdInr: string | null;
  readonly closingAt: string | null;
  readonly bidOpeningAt: string | null;
  readonly districtName: string | null;
  readonly districtSource: string | null;
  readonly districtEvidenceKey: string | null;
  readonly linkageConfidence: number | null;
  /** Every label → value the detail page states; null where it was never read. */
  readonly detailFields: Readonly<Record<string, string>> | null;
  readonly sourceUrl: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly changes: number;
}

/**
 * The labels portals print each field under. More than one, because portals
 * word some labels differently; the first one present wins.
 */
const LABELS = {
  workDescription: ["Work Description", "Work Item Description"],
  contractForm: ["Form Of Contract", "Form of Contract", "Contract Type"],
  tenderFee: ["Tender Fee in ₹", "Tender Fee in Rs", "Tender Fee"],
  published: ["Published Date", "Publish Date"],
  documentsFrom: ["Document Download / Sale Start Date", "Document Download Start Date"],
  documentsUntil: ["Document Download / Sale End Date", "Document Download End Date"],
  preBidDate: ["Pre Bid Meeting Date"],
  preBidPlace: ["Pre Bid Meeting Place", "Pre Bid Meeting Address"],
  periodOfWork: ["Period Of Work(Days)", "Period Of Work (Days)", "Period of Work(Days)"],
} as const;

function fromPage(
  fields: TenderRecordInput["detailFields"],
  labels: readonly string[],
): string | null {
  if (fields === null) return null;
  for (const label of labels) {
    const value = fields[label]?.trim();
    if (value !== undefined && value !== "") return value;
  }
  return null;
}

const known = (value: FieldValue): FieldState => ({ state: "known", value });
const missing = (why: MissingReason): FieldState => ({ state: "missing", why });

/** A field read from the detail page: absent from the page, or the page never read. */
function pageField(
  input: TenderRecordInput,
  labels: readonly string[],
  as: (text: string) => FieldValue,
): FieldState {
  if (input.detailFields === null) return missing("detail_not_read");
  const text = fromPage(input.detailFields, labels);
  return text === null ? missing("not_on_page") : known(as(text));
}

/** A column the collector keeps: absent from the page, or the page never read. */
function column(input: TenderRecordInput, value: FieldValue | null): FieldState {
  if (value !== null) return known(value);
  return missing(input.detailFields === null ? "detail_not_read" : "not_on_page");
}

const text = (t: string | null): FieldValue | null =>
  t === null ? null : { kind: "text", text: t };
const rupees = (inr: string | null): FieldValue | null =>
  inr === null ? null : { kind: "rupees", inr };
const asPrinted = (t: string): FieldValue => ({ kind: "as_printed", text: t });
const asText = (t: string): FieldValue => ({ kind: "text", text: t });

function officeDistrict(input: TenderRecordInput): FieldState {
  if (input.districtName === null || input.districtSource === null) {
    return missing("district_not_established");
  }
  return known({
    kind: "office_district",
    name: input.districtName,
    method: input.districtSource,
    evidence: input.districtEvidenceKey,
    confidence: input.linkageConfidence,
  });
}

function issuingOffice(input: TenderRecordInput): FieldState {
  const offices = (input.organisationChain ?? "")
    .split("||")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return column(input, offices.length === 0 ? null : { kind: "chain", offices });
}

/** Two labels read together, joined by `separator`, as printed. */
function joinedPageField(
  input: TenderRecordInput,
  labels: readonly (readonly string[])[],
  separator: string,
): FieldState {
  if (input.detailFields === null) return missing("detail_not_read");
  const parts = labels
    .map((l) => fromPage(input.detailFields, l))
    .filter((p): p is string => p !== null);
  return parts.length === 0 ? missing("not_on_page") : known(asPrinted(parts.join(separator)));
}

/** Where the tender stands, from its closing date; never an award. */
export function tenderStatus(closingAt: string | null, now: Date): TenderStatus {
  if (closingAt === null) return { kind: "unknown" };
  return new Date(closingAt).getTime() > now.getTime()
    ? { kind: "open", closesAt: closingAt }
    : { kind: "closed", closedAt: closingAt };
}

function sectionsOf(input: TenderRecordInput): TenderSection[] {
  const date = (iso: string | null): FieldValue | null =>
    iso === null ? null : { kind: "date", iso };
  return [
    {
      key: "what",
      fields: [
        { key: "title", value: known(asText(input.title)) },
        { key: "workDescription", value: pageField(input, LABELS.workDescription, asText) },
        { key: "tenderCategory", value: column(input, text(input.tenderCategory)) },
        { key: "workCategory", value: column(input, text(input.productCategory)) },
        { key: "tenderType", value: column(input, text(input.tenderType)) },
        { key: "contractForm", value: pageField(input, LABELS.contractForm, asText) },
      ],
    },
    {
      key: "where",
      fields: [
        { key: "officeDistrict", value: officeDistrict(input) },
        { key: "statedLocation", value: column(input, text(input.location)) },
        { key: "pincode", value: column(input, text(input.pincode)) },
        { key: "workSite", value: missing("site_not_stated") },
      ],
    },
    {
      key: "who",
      fields: [
        { key: "department", value: column(input, text(input.department)) },
        { key: "issuingOffice", value: issuingOffice(input) },
        { key: "bidders", value: missing("award_not_collected") },
        { key: "winner", value: missing("award_not_collected") },
      ],
    },
    {
      key: "money",
      fields: [
        { key: "estimatedValue", value: column(input, rupees(input.tenderValueInr)) },
        { key: "bidSecurity", value: column(input, rupees(input.emdInr)) },
        { key: "tenderFee", value: pageField(input, LABELS.tenderFee, asPrinted) },
        { key: "winningBid", value: missing("award_not_collected") },
        { key: "contractValue", value: missing("award_not_collected") },
        { key: "amountPaid", value: missing("progress_not_available") },
      ],
    },
    {
      key: "when",
      fields: [
        { key: "published", value: pageField(input, LABELS.published, asPrinted) },
        {
          key: "documentsAvailable",
          value: joinedPageField(input, [LABELS.documentsFrom, LABELS.documentsUntil], " to "),
        },
        {
          key: "preBidMeeting",
          value: joinedPageField(input, [LABELS.preBidDate, LABELS.preBidPlace], ", "),
        },
        { key: "bidsClose", value: column(input, date(input.closingAt)) },
        { key: "bidsOpen", value: column(input, date(input.bidOpeningAt)) },
        { key: "periodOfWork", value: pageField(input, LABELS.periodOfWork, asPrinted) },
        { key: "workProgress", value: missing("progress_not_available") },
      ],
    },
  ];
}

/** The record, one section per question, every field known or missing with its reason. */
export function tenderRecord(input: TenderRecordInput, now: Date = new Date()): TenderRecord {
  return {
    id: input.id,
    title: input.title,
    reference: input.reference,
    status: tenderStatus(input.closingAt, now),
    sections: sectionsOf(input),
    source: {
      portalCode: input.portalCode,
      url: input.sourceUrl,
      firstSeenAt: input.firstSeenAt,
      lastSeenAt: input.lastSeenAt,
    },
    changes: input.changes,
  };
}
