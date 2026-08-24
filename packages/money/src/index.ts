/**
 * Money — an exact monetary value in Indian paise.
 *
 * WHY bigint, not number:
 * docs/04 stores amounts as NUMERIC(20,2). A national multi-year aggregate
 * (Union Budget scale, ~₹50 lakh crore) is ~5e14 paise. Number.MAX_SAFE_INTEGER
 * is ~9.007e15 — under two orders of magnitude of headroom, while docs/14
 * projects ~1e10 fact rows nationally. A float overflow here does not throw:
 * it silently produces a wrong government figure carrying a correct-looking
 * source link. That is the single worst failure this product can have, so the
 * type system forbids it.
 *
 * Amounts cross the wire as decimal STRINGS (see @lokdarpan/api-contract).
 * There is no `fromNumber`, deliberately.
 */

const PAISE_PER_RUPEE = 100n;
const RUPEES_PER_LAKH = 100_000n;
const RUPEES_PER_CRORE = 10_000_000n;

export type MoneyStyle = "crore-lakh" | "full" | "compact";
export type Locale = "en" | "mr" | "hi";

export class Money {
  private constructor(private readonly paise: bigint) {}

  /** Parse a decimal string as delivered by the API, e.g. "900000000.00". */
  static fromDecimalString(value: string): Money {
    const trimmed = value.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
      throw new TypeError(`Money: not a valid decimal amount: ${JSON.stringify(value)}`);
    }
    const negative = trimmed.startsWith("-");
    const unsigned = negative ? trimmed.slice(1) : trimmed;
    const [rupeePart = "0", fractionPart = ""] = unsigned.split(".");
    const paisePart = fractionPart.padEnd(2, "0");
    const magnitude = BigInt(rupeePart) * PAISE_PER_RUPEE + BigInt(paisePart);
    return new Money(negative ? -magnitude : magnitude);
  }

  static fromPaise(paise: bigint): Money {
    return new Money(paise);
  }

  static zero(): Money {
    return new Money(0n);
  }

  static sum(values: readonly Money[]): Money {
    return values.reduce<Money>((acc, v) => acc.plus(v), Money.zero());
  }

  toPaise(): bigint {
    return this.paise;
  }

  plus(other: Money): Money {
    return new Money(this.paise + other.paise);
  }

  /**
   * Presentational subtraction only. Variances arrive pre-computed from the
   * analytics tier (docs/06) with their own provenance — the client must never
   * derive a variance and present it as a fact. See .docs/27 §Money handling.
   */
  minus(other: Money): Money {
    return new Money(this.paise - other.paise);
  }

  compare(other: Money): -1 | 0 | 1 {
    if (this.paise < other.paise) return -1;
    if (this.paise > other.paise) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.paise === other.paise;
  }

  isZero(): boolean {
    return this.paise === 0n;
  }

  isNegative(): boolean {
    return this.paise < 0n;
  }

  toDecimalString(): string {
    const negative = this.paise < 0n;
    const abs = negative ? -this.paise : this.paise;
    const rupees = abs / PAISE_PER_RUPEE;
    const paise = abs % PAISE_PER_RUPEE;
    return `${negative ? "-" : ""}${rupees}.${paise.toString().padStart(2, "0")}`;
  }

  /**
   * Indian digit grouping: last three digits, then groups of two.
   * 80000000 -> "8,00,00,000"
   */
  private static groupIndian(digits: string): string {
    if (digits.length <= 3) return digits;
    const head = digits.slice(0, -3);
    const tail = digits.slice(-3);
    return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
  }

  format(_locale: Locale = "en", style: MoneyStyle = "crore-lakh"): string {
    // Numerals stay Latin in every locale: source documents use Latin digits,
    // and a reader cross-checking against a PDF must see the same glyphs.
    // See .docs/12-accessibility.md §Language and reading.
    const negative = this.paise < 0n;
    const sign = negative ? "-" : "";
    const abs = negative ? -this.paise : this.paise;
    const rupees = abs / PAISE_PER_RUPEE;

    if (style === "full") {
      return `${sign}₹${Money.groupIndian(rupees.toString())}`;
    }

    if (style === "crore-lakh" || style === "compact") {
      if (rupees >= RUPEES_PER_CRORE) {
        return `${sign}₹${Money.scaled(rupees, RUPEES_PER_CRORE)} crore`;
      }
      if (rupees >= RUPEES_PER_LAKH) {
        return `${sign}₹${Money.scaled(rupees, RUPEES_PER_LAKH)} lakh`;
      }
    }
    return `${sign}₹${Money.groupIndian(rupees.toString())}`;
  }

  /** Two decimal places, exact — computed on bigint, never via division to float. */
  private static scaled(rupees: bigint, unit: bigint): string {
    const whole = rupees / unit;
    const remainder = ((rupees % unit) * 100n) / unit;
    return `${Money.groupIndian(whole.toString())}.${remainder.toString().padStart(2, "0")}`;
  }

  /** Screen-reader text: the unit is spoken, never a digit string. */
  toAccessibleString(locale: Locale = "en"): string {
    const spoken = this.format(locale, "crore-lakh").replace("₹", "").trim();
    return `${spoken.replace(/^-/, "minus ")} rupees`;
  }

  toJSON(): string {
    return this.toDecimalString();
  }
}
