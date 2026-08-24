/**
 * The forbidden vocabulary of docs/15-Legal-Ethical-Rules.md.
 *
 * Shared between the server's text generation and every client, so the two can
 * never drift. docs/15 §Enforcement requires ONE gate; two copies of this list
 * is one copy too many.
 *
 * NOTE ON TRANSLATIONS: the Devanagari terms below are a starting set and MUST
 * be reviewed by native Marathi and Hindi speakers before launch. A forbidden
 * word we failed to list is a forbidden word that ships. Tracked as a launch
 * gate in .docs/28 §W10.
 */

/** Words asserting wrongdoing, criminality, or intent. */
export const FORBIDDEN_TERMS: Readonly<Record<"en" | "mr" | "hi", readonly string[]>> = {
  // Inflections are listed explicitly. A flat list silently misses irregular
  // forms — an early version caught "steal"/"stolen" but not "stole", letting
  // one of docs/15's own forbidden examples through. Prefer stems where a stem
  // is safe ("misappropriat" covers -e/-ed/-ion), and enumerate irregulars.
  en: [
    "corrupt",
    "corruption",
    "corruptly",
    "scam",
    "scammed",
    "steal",
    "stole",
    "stolen",
    "stealing",
    "theft",
    "thief",
    "thieves",
    "fraud",
    "fraudulent",
    "defraud",
    "defrauded",
    "embezzle",
    "embezzled",
    "embezzlement",
    "misappropriat",
    "guilty",
    "guilt",
    "illegal",
    "illegally",
    "unlawful",
    "criminal",
    "crime",
    "bribe",
    "bribed",
    "bribery",
    "kickback",
    "siphon",
    "siphoned",
    "siphoning",
    "divert",
    "diverted",
    "diversion",
    "loot",
    "looted",
    "looting",
    "swindle",
    "swindled",
    "wrongdoing",
    "malpractice",
    "malfeasance",
    "dishonest",
    "dishonesty",
    "rigged",
    "rigging",
    "collude",
    "colluded",
    "collusion",
    "suspicious",
    "suspect",
    "culprit",
    "accused",
    "cheat",
    "cheated",
    "cheating",
    "nepotism",
    "favouritism",
    "favoritism",
  ],
  mr: [
    "भ्रष्टाचार",
    "घोटाळा",
    "चोरी",
    "फसवणूक",
    "लाच",
    "अपहार",
    "गुन्हा",
    "गुन्हेगार",
    "दोषी",
    "बेकायदेशीर",
    "गैरव्यवहार",
    "संशयास्पद",
  ],
  hi: [
    "भ्रष्टाचार",
    "घोटाला",
    "चोरी",
    "धोखाधड़ी",
    "रिश्वत",
    "गबन",
    "अपराध",
    "अपराधी",
    "दोषी",
    "गैरकानूनी",
    "अनियमितता",
    "संदिग्ध",
  ],
} as const;

/**
 * Causal constructions. docs/15 rule 2: a variance is a number; the platform
 * never claims what caused it. These catch "X because Y" phrasing even when
 * every individual word is permitted.
 */
export const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bbecause (?:the |of )?(?:contractor|official|department|they|he|she)\b/i,
  /\bdue to (?:misuse|misreporting|diversion|negligence|fraud)\b/i,
  /\b(?:funds?|money) (?:were|was) (?:diverted|misused|stolen|siphoned)\b/i,
  /\b(?:this|that) (?:is|looks like|suggests|indicates) corruption\b/i,
  /\b(?:hid|hiding|concealed|covered up) the (?:money|funds|figures)\b/i,
  /\bovercharg(?:e|ed|ing)\b/i,
  /\bshould be (?:investigated|prosecuted|punished)\b/i,
] as const;

/** The neutral vocabulary docs/15 prescribes instead — used by the CLI's hints. */
export const PREFERRED_ALTERNATIVES: Readonly<Record<string, string>> = {
  corrupt: "deviation / inconsistency",
  corruption: "data inconsistency",
  stolen: "unreconciled",
  theft: "unexplained variance",
  fraud: "inconsistency requiring verification",
  suspicious: "worth verifying / verification priority",
  overcharged: "reported cost is X% above the district median",
  illegal: "(no equivalent — the platform makes no legal statements)",
} as const;

/**
 * Phrases docs/15 REQUIRES that necessarily contain forbidden vocabulary in
 * negated form. A naive word-match blocks the very text the rules mandate — so
 * these are excised before scanning.
 *
 * Keep this list exact and short. It is an allowlist for *mandated* copy, not
 * an escape hatch: adding a phrase here is a docs/15 decision, not a lint fix.
 */
export const MANDATED_PHRASES: readonly string[] = [
  "not findings of wrongdoing",
  "not a finding of wrongdoing",
  "is not a claim of wrongdoing",
  "does not indicate that anything is wrong",
  "not an accusation",
  "never an accusation",
  "no claim of wrongdoing",
] as const;
