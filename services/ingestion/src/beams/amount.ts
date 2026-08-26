/**
 * BEAMS publishes amounts in **thousands of rupees**, with three decimals:
 * `126579.000` means ₹12,65,79,000 — not ₹126,579.
 *
 * Reading those numbers as rupees understates every government figure by three
 * orders of magnitude while looking entirely plausible next to a correct source
 * link. That is this project's worst failure mode, so the conversion is done
 * here, once, on strings, with no floating point anywhere in the path.
 *
 * thousands → rupees is ×1,000; rupees → paise is ×100; so the whole conversion
 * is a decimal-point shift of five places.
 */

const THOUSANDS = /^(-?)(\d+)(?:\.(\d+))?$/u;

/** Values BEAMS uses for "no figure here". None of them is zero. */
const ABSENT = new Set(["", "-", "--", "---", "NA", "N/A", "null"]);

const PAISE_SHIFT = 5;

export class AmountFormatError extends Error {
  public override readonly name = "AmountFormatError";
}

/**
 * Converts a BEAMS amount in thousands to exact paise.
 *
 * Returns `null` where the source published no figure — never zero. A zero is a
 * government asserting an amount; an absence is the lack of an assertion.
 */
export function thousandsToPaise(raw: string): bigint | null {
  const trimmed = raw.trim().replace(/,/gu, "");
  if (ABSENT.has(trimmed) || ABSENT.has(trimmed.toUpperCase())) return null;

  const match = THOUSANDS.exec(trimmed);
  if (match === null) {
    throw new AmountFormatError(
      `"${raw}" is not a BEAMS amount. Refusing to guess at a government figure.`,
    );
  }

  const [, sign, whole, fraction = ""] = match;

  // More than five decimal places in a thousands figure would express less than
  // one paisa. Rounding it would silently invent precision the source does not
  // have, so it is refused instead.
  if (fraction.length > PAISE_SHIFT) {
    throw new AmountFormatError(
      `"${raw}" carries sub-paise precision (${String(fraction.length)} decimals). ` +
        `Rounding would invent precision the source does not claim.`,
    );
  }

  const digits = `${whole ?? "0"}${fraction}`;
  const paise = BigInt(digits) * 10n ** BigInt(PAISE_SHIFT - fraction.length);
  return sign === "-" ? -paise : paise;
}
