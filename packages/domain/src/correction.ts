/**
 * A report of a data error, as a reader submits it (ADR-075).
 *
 * The rules here mirror the constraints on `correction_request` (migration
 * 0046) so that a reader is told what to change before the database refuses
 * anything. The database still checks every one: this is courtesy, not the
 * guarantee.
 */

export const CORRECTION_CATEGORIES = [
  "amount_wrong",
  "name_wrong",
  "place_wrong",
  "document_wrong",
  "duplicate",
  "outdated",
  "missing",
  "other",
] as const;

export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number];

export interface CorrectionInput {
  /** `fact:123`, `document:12`, `body:4`, `unit:20`, `tender:9`, or `page:/path`. */
  readonly subject: string;
  readonly category: CorrectionCategory;
  readonly description: string;
  /** Where the reader says the right value is published, or `null`. */
  readonly evidenceUrl: string | null;
}

/** Why a submission was not accepted, by field. */
export type CorrectionProblem =
  | "subject"
  | "category"
  | "description_short"
  | "description_long"
  | "evidence_url"
  /** A field no person sees was filled: an automated submission. */
  | "automated";

export type CorrectionParse =
  | { readonly ok: true; readonly value: CorrectionInput }
  | { readonly ok: false; readonly problems: readonly CorrectionProblem[] };

const RECORD_SUBJECT = /^(fact|document|body|unit|tender):[1-9][0-9]{0,18}$/u;
const PAGE_SUBJECT = /^page:\/\S*$/u;
const MAX_PAGE_SUBJECT = 306;
const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 4000;
const MAX_EVIDENCE_URL = 1000;
const WEB_ADDRESS = /^https?:\/\/\S+$/u;

/** The name of the field people never see; anything in it marks a script. */
export const HONEYPOT_FIELD = "website";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function isCorrectionSubject(subject: string): boolean {
  return (
    RECORD_SUBJECT.test(subject) ||
    (PAGE_SUBJECT.test(subject) && subject.length <= MAX_PAGE_SUBJECT)
  );
}

/** Read a submission from form fields or a JSON body. */
export function parseCorrection(fields: Readonly<Record<string, unknown>>): CorrectionParse {
  const problems: CorrectionProblem[] = [];

  if (text(fields[HONEYPOT_FIELD]) !== "") problems.push("automated");

  const subject = text(fields["subject"]);
  if (!isCorrectionSubject(subject)) problems.push("subject");

  const categoryRaw = text(fields["category"]);
  const category = CORRECTION_CATEGORIES.find((c) => c === categoryRaw);
  if (category === undefined) problems.push("category");

  const description = text(fields["description"]);
  if (description.length < MIN_DESCRIPTION) problems.push("description_short");
  if (description.length > MAX_DESCRIPTION) problems.push("description_long");

  const evidence = text(fields["evidenceUrl"]);
  if (evidence !== "" && (!WEB_ADDRESS.test(evidence) || evidence.length > MAX_EVIDENCE_URL)) {
    problems.push("evidence_url");
  }

  if (problems.length > 0 || category === undefined) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    value: { subject, category, description, evidenceUrl: evidence === "" ? null : evidence },
  };
}
