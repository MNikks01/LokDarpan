import { amountToPaise } from "../cag/facts";

/**
 * Values a person supplies for figures the parser would not read.
 *
 * The residue of the `no_value` partition is not one problem with one rule. It
 * is a misspelled unit ("₹ 145 core"), an abbreviated one ("₹ 7,700 cr"), and a
 * unit deferred to a later figure in a list ("₹ 11,977 and ₹ 13,782.36 crore").
 * Each needs a reader to decide what the sentence means, and teaching the
 * parser to guess at any of them would put that guess behind every future
 * figure rather than behind the twenty-three it was reasoned about.
 *
 * So they are corrections: named facts, explicit values, each with a reason,
 * in a file that can be read and diffed before it is applied.
 *
 * THE AMOUNT IS WRITTEN THE WAY THE SOURCE WRITES IT
 * `{ "amount": "145", "unit": "crore" }`, never paise. Hand-computing paise is
 * how a figure ends up an order of magnitude out — it happened repeatedly while
 * writing the tests for this very module — so the conversion goes through
 * `amountToPaise`, the same path the parser uses, and there is one money
 * conversion in this codebase rather than two.
 */

export interface Correction {
  readonly id: number;
  /** Digits as the page prints them: "145", "13,782.36". */
  readonly amount: string;
  /** A unit the parser knows, or "rupees" for a figure written out in full. */
  readonly unit: string;
  /** Why this reading, in a sentence. Required; a blank one is refused. */
  readonly note: string;
}

export interface PreparedCorrection extends Correction {
  /** Exact paise, converted by the parser's own money path. */
  readonly paise: string;
}

export class CorrectionError extends Error {
  public override readonly name = "CorrectionError";
}

/** Checks one entry's shape, or says what is wrong with it. */
function validated(entry: unknown, where: string): Correction {
  if (typeof entry !== "object" || entry === null) {
    throw new CorrectionError(`${where}: not an object.`);
  }
  const { id, amount, unit, note } = entry as Partial<Correction>;

  if (typeof id !== "number" || !Number.isInteger(id)) {
    throw new CorrectionError(`${where}: "id" must be a fact id.`);
  }
  if (typeof amount !== "string" || amount.trim() === "") {
    throw new CorrectionError(`#${String(id)}: "amount" must be the digits the page prints.`);
  }
  if (typeof unit !== "string" || unit.trim() === "") {
    throw new CorrectionError(`#${String(id)}: "unit" must be a unit, or "rupees".`);
  }
  // Required, and for the same reason `reviseDecision` requires one: a
  // published figure that came from a person rather than the page has to be
  // able to say why, or the correction is itself an unaccountable claim.
  if (typeof note !== "string" || note.trim() === "") {
    throw new CorrectionError(`#${String(id)}: "note" must say why this is the right reading.`);
  }
  return { id, amount, unit, note: note.trim() };
}

/** Exact paise, through the parser's own money path. Never arithmetic here. */
function paiseOf(c: Correction): string {
  const paise =
    c.unit === "rupees"
      ? amountToPaise(c.amount, undefined, "rupees")
      : amountToPaise(c.amount, c.unit, "refuse");
  if (paise === null) {
    throw new CorrectionError(
      `#${String(c.id)}: "${c.amount}" in "${c.unit}" is not an amount this codebase can ` +
        `represent exactly. Refusing to guess at a government figure.`,
    );
  }
  return paise.toString();
}

/** Parses and checks a corrections file, or explains what is wrong with it. */
export function prepareCorrections(raw: unknown): PreparedCorrection[] {
  if (!Array.isArray(raw)) {
    throw new CorrectionError("A corrections file is a JSON array of entries.");
  }
  return raw.map((entry, index) => {
    const correction = validated(entry, `entry ${String(index + 1)}`);
    return { ...correction, paise: paiseOf(correction) };
  });
}
