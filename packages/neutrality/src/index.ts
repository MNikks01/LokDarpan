import {
  FORBIDDEN_TERMS,
  FORBIDDEN_PATTERNS,
  PREFERRED_ALTERNATIVES,
  MANDATED_PHRASES,
} from "./vocabulary";

export { FORBIDDEN_TERMS, FORBIDDEN_PATTERNS, PREFERRED_ALTERNATIVES, MANDATED_PHRASES };

export type Locale = "en" | "mr" | "hi";

export interface Violation {
  readonly kind: "term" | "pattern";
  readonly match: string;
  readonly locale: Locale | "any";
  readonly index: number;
  readonly suggestion?: string;
}

/**
 * Scan a string for language forbidden by docs/15.
 * Returns every violation rather than short-circuiting, so a reviewer sees the
 * full picture in one pass.
 */
export function scan(text: string, locales: readonly Locale[] = ["en", "mr", "hi"]): Violation[] {
  const found: Violation[] = [];
  // Excise docs/15-mandated disclaimers first, preserving offsets so reported
  // indices still point at the real source position.
  let scannable = text;
  for (const phrase of MANDATED_PHRASES) {
    // Whitespace-flexible: JSX wraps prose across lines, so the mandated
    // phrase is rarely contiguous in source.
    const source = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(source, "gi");
    scannable = scannable.replace(re, (m) => " ".repeat(m.length));
  }
  const haystack = scannable.toLowerCase();

  for (const locale of locales) {
    for (const term of FORBIDDEN_TERMS[locale]) {
      const needle = term.toLowerCase();
      let from = 0;
      for (;;) {
        const at = haystack.indexOf(needle, from);
        if (at === -1) break;
        const suggestion = PREFERRED_ALTERNATIVES[needle];
        found.push({
          kind: "term",
          match: scannable.slice(at, at + term.length),
          locale,
          index: at,
          ...(suggestion === undefined ? {} : { suggestion }),
        });
        from = at + needle.length;
      }
    }
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );
    for (const m of scannable.matchAll(re)) {
      found.push({ kind: "pattern", match: m[0], locale: "any", index: m.index });
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

export function isNeutral(text: string, locales?: readonly Locale[]): boolean {
  return scan(text, locales).length === 0;
}

/**
 * ServerText — a branded string proving the text came from the server, where it
 * was generated from vetted templates and passed the neutrality checker
 * (docs/15 §Enforcement).
 *
 * A component that renders an observation accepts only this type, so a developer
 * CANNOT write <Observation text="This contractor overcharged" /> — it is a
 * compile error, not a code-review catch. See .docs/27 §Neutrality primitives.
 */
declare const serverTextBrand: unique symbol;
export type ServerText = string & { readonly [serverTextBrand]: "server-authored" };

/** The ONLY way to mint ServerText. Called at the API boundary, never in a component. */
export function asServerText(value: string, origin: "api"): ServerText {
  // Typed callers cannot reach this; untyped JS callers can, and this is a
  // docs/15 boundary worth guarding at runtime as well as at compile time.
  if ((origin as string) !== "api") {
    throw new Error("ServerText may only originate from the API boundary");
  }
  return value as ServerText;
}
