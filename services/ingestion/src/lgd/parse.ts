import { parse as parseHtml } from "node-html-parser";

/** One State/UT exactly as the Local Government Directory publishes it. */
export interface LgdState {
  readonly lgdCode: string;
  readonly nameEn: string;
  /** `null` when LGD publishes no genuine local-language name — see `localName`. */
  readonly nameLocal: string | null;
  readonly isUnionTerritory: boolean;
  readonly census2001Code: string | null;
  readonly census2011Code: string | null;
}

/**
 * Any character outside Latin, plus the script-neutral categories.
 *
 * `Common` covers spaces, digits and punctuation; `Inherited` covers combining
 * marks, which take the script of the base character they attach to. Both must
 * be excluded or a Devanagari string would be judged by its matras rather than
 * its letters. Written as a property escape rather than iterating code points:
 * spreading a string splits surrogate pairs and separates combining marks from
 * their base, which is exactly the input this function exists to classify.
 */
const NON_LATIN_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/**
 * LGD's "State Name (In Local language)" column is populated for only some
 * units. For the rest it repeats the English name in upper case — `ASSAM`,
 * `BIHAR`. That is not a local-language name, and storing it as one would make
 * the app render `ASSAM` as though it were Marathi.
 *
 * Missing is missing: a Latin-script value is recorded as not-published.
 */
export function localName(nameEn: string, raw: string): string | null {
  const trimmed = raw.trim().normalize("NFC");
  if (trimmed === "") return null;
  if (!NON_LATIN_SCRIPT.test(trimmed)) return null;
  if (trimmed.toUpperCase() === nameEn.trim().toUpperCase()) return null;
  return trimmed;
}

/** LGD leaves absent codes as an empty cell, `-` or `NA`. None of those is a code. */
function optionalCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed.toUpperCase() === "NA") return null;
  return trimmed;
}

const EXPECTED_HEADERS = [
  "State LGD Code",
  "State Name (In English)",
  "State Name (In Local language)",
  "State or UT",
] as const;

/**
 * Cell text, whitespace-collapsed and **normalised to NFC**.
 *
 * LGD emits some Indic characters decomposed — `ढ़` arrives as `ढ` + nukta
 * (U+0922 U+093C) rather than the precomposed U+095D. The two are visually
 * identical and compare unequal, so without normalisation a search for a state
 * name would silently miss it, and the same unit fetched twice could produce
 * two different stored strings.
 */
const text = (node: { textContent: string }): string =>
  node.textContent.replace(/\s+/gu, " ").trim().normalize("NFC");

/**
 * A silently reordered or renamed column would load one field's values into
 * another and look entirely successful, so positions are only trusted after the
 * table's own headers confirm them.
 */
function assertExpectedHeaders(headers: readonly string[]): void {
  const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length === 0) return;
  throw new Error(
    `LGD state table is missing expected column(s): ${missing.join(", ")}. ` +
      `Found: ${headers.filter((h) => h !== "").join(" | ")}. ` +
      `The page structure has changed; the parser must be revisited rather than guessing positions.`,
  );
}

function toState(cells: readonly string[]): LgdState {
  const lgdCode = cells[1] ?? "";
  const nameEn = cells[2] ?? "";
  const kindRaw = cells[4] ?? "";
  const kind = kindRaw.toUpperCase();

  if (!/^\d+$/u.test(lgdCode)) {
    throw new Error(`LGD code "${lgdCode}" for "${nameEn}" is not numeric.`);
  }
  if (nameEn === "") {
    throw new Error(`A state row (LGD code ${lgdCode}) has no English name.`);
  }
  if (kind !== "STATE" && kind !== "UT") {
    throw new Error(`Unexpected "State or UT" value "${kindRaw}" for "${nameEn}".`);
  }

  return {
    lgdCode,
    nameEn,
    nameLocal: localName(nameEn, cells[3] ?? ""),
    isUnionTerritory: kind === "UT",
    census2001Code: optionalCode(cells[5] ?? ""),
    census2011Code: optionalCode(cells[6] ?? ""),
  };
}

function assertNoDuplicateCodes(states: readonly LgdState[]): void {
  const seen = new Set<string>();
  for (const state of states) {
    if (seen.has(state.lgdCode)) {
      throw new Error(`Duplicate LGD code ${state.lgdCode} in one response.`);
    }
    seen.add(state.lgdCode);
  }
}

/** Parses the citizen-facing State/UT listing. */
export function parseStates(html: string): LgdState[] {
  const root = parseHtml(html);
  assertExpectedHeaders(root.querySelectorAll("th").map(text));

  const states: LgdState[] = [];
  for (const row of root.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("td").map(text);
    // Data rows begin with a serial number; headers, notes and layout rows do not.
    if (cells.length >= 7 && /^\d+$/u.test(cells[0] ?? "")) {
      states.push(toState(cells));
    }
  }

  if (states.length === 0) {
    throw new Error("LGD state table contained no data rows — refusing to report an empty ingest.");
  }
  assertNoDuplicateCodes(states);
  return states;
}
