/**
 * A GePNIC tender detail page, as this ledger will accept it.
 *
 * Pure: no network, no database. The page is reachable without an interactive
 * check but only inside a live session, so the fetcher holds a cookie jar; none
 * of that belongs here.
 *
 * WHAT THE PAGE ADDS OVER THE LANDING LIST
 * The landing page states four fields. The detail page states around seventy-
 * six, including the two this ledger cares most about: which office issued the
 * tender, and where that office sits.
 *
 * THE DISTINCTION THAT GOVERNS EVERY LABEL DOWNSTREAM
 * The organisation chain names the OFFICE THAT ISSUED the tender. It does not
 * state where the work will be done. A Chief Engineer's circle office in
 * Tirunelveli tenders work across several districts, so a district derived from
 * the chain is "the district of the issuing office" and must be worded that
 * way. Rendering it as "tenders in this district" asserts something the source
 * never said.
 */

export interface TenderDetail {
  /** First segment of the organisation chain. Reliably present. */
  readonly department: string;
  /** Every segment, outermost first, for display and for audit. */
  readonly organisationChain: readonly string[];
  /**
   * A district name as the portal spells it, or null when the chain names
   * none. Resolving it to a ledger unit happens later and separately, because
   * the spellings differ: the portal writes "Villupuram" where OpenStreetMap
   * writes "Viluppuram", and "Kannyakumari" for "Kanniyakumari".
   */
  readonly districtName: string | null;
  /**
   * How the district was found. `chain_unit` is a clean segment; `office_code`
   * was dug out of a name like "CE-Tirunelveli", which is a weaker claim
   * because such an office covers more than its own district.
   */
  readonly districtSource: "chain_unit" | "office_code" | null;
  /** The portal's free-text location. Often an office, not a place. */
  readonly location: string | null;
  readonly pincode: string | null;
  readonly tenderCategory: string | null;
  readonly productCategory: string | null;
  readonly tenderType: string | null;
  /** Paise. Null where the portal prints "NA", which it usually does. */
  readonly tenderValuePaise: bigint | null;
  readonly emdPaise: bigint | null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, "&");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Every `label → value` pair the page states, first occurrence winning. */
export function labelledValues(html: string): ReadonlyMap<string, string> {
  const pairs = new Map<string, string>();
  for (const [, rowHtml = ""] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell = ""]) =>
      stripTags(cell),
    );
    // GePNIC lays detail out as label/value pairs across a row, several per row.
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const [label = "", value = ""] = cells.slice(i, i + 2);
      if (label === "" || value === "" || label.length > 48 || label === value) continue;
      if (!pairs.has(label)) pairs.set(label, value);
    }
  }
  return pairs;
}

/**
 * Rupees as paise, or null.
 *
 * The portal prints `5,92,000` in the Indian grouping and `NA` when it does not
 * publish a figure — which is most of the time. `NA` is an absence, not a zero:
 * rendering it as ₹0 would state that a government advertised work worth
 * nothing.
 */
export function rupeesToPaise(text: string | undefined): bigint | null {
  if (text === undefined) return null;
  const cleaned = text.replace(/[,\s₹]/g, "");
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

/**
 * A place name reduced to what survives transliteration.
 *
 * Indian place names vary systematically in romanisation — doubled consonants
 * and interchangeable vowels — so `Villupuram` and `Viluppuram` are one place
 * spelled two ways, as are `Kannyakumari` and `Kanniyakumari`. Collapsing
 * repeats and dropping vowels makes those agree without inventing a similarity
 * score, which would match places that merely look alike.
 */
export function normalise(name: string): string {
  // Deliberately lossy, and only safe within one state — see districtFromChain.
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/[aeiou]/g, "");
}

/** `Villupuram,RD,TN` → `Villupuram`. */
function cleanSegment(segment: string): string {
  // `split` always yields at least one element, so no fallback is reachable.
  const [head = ""] = segment.split(",");
  return head.trim();
}

/**
 * A district name from the organisation chain, and how confidently.
 *
 * The chain runs outermost to innermost, so it is read from the deepest segment
 * back: a TANGEDCO chain names both `CE-Tirunelveli` (a circle covering several
 * districts) and `SE-Kannyakumari` (a division inside it), and the narrower
 * office is the better answer of the two.
 *
 * `known` MUST hold only the districts of the portal's own state, normalised.
 * This is not a caller's convenience; it is what makes the match safe. Across
 * all 787 districts the normalisation collapses eighteen pairs of genuinely
 * different places — `Pune` with `Panna`, `Karnal` with `Kurnool`, `Jalna` with
 * `Jalaun` — so a nationwide set would place a Pune tender in Madhya Pradesh
 * and look confident doing it. Within any single state there are zero
 * collisions, and a state's e-procurement portal advertises that state's work,
 * so the scope is both safe and true.
 *
 * A wrong placement is worse than none: an unplaced tender is visibly missing,
 * while a misplaced one is a false fact about where public money is going.
 */
export function districtFromChain(
  chain: readonly string[],
  known: ReadonlySet<string>,
): { readonly name: string; readonly source: "chain_unit" | "office_code" } | null {
  // Two passes, and the order between them matters more than depth does.
  //
  // A segment that IS a district is a stronger claim than a district name found
  // inside an office name, so every segment is checked for the first kind
  // before any is checked for the second. Depth breaks ties within each kind.
  //
  // Without this the RD chain answers from its deepest segment — a village,
  // `MUGAIYUR - VP, VILLUPURAM,RD,TN` — and reports the right district under
  // the weaker label, when the segment above it states that district outright.
  // Segment 0 is the department, never a placement, so it is dropped before
  // either pass rather than skipped by an index test in both.
  const units = chain.slice(1).reverse();

  for (const segment of units) {
    const cleaned = cleanSegment(segment);
    if (cleaned !== "" && known.has(normalise(cleaned))) {
      return { name: cleaned, source: "chain_unit" };
    }
  }

  // Nothing in the chain is a district outright. Fall back to a name embedded
  // in an office code like `CE-Tirunelveli - TANGEDCO`, deepest first: the
  // office's reach is wider than its own district, so this is the weaker claim
  // and downstream confidence must be able to tell the two apart.
  for (const segment of units) {
    for (const word of segment.split(/[-,|]/)) {
      const candidate = word.trim();
      if (candidate !== "" && known.has(normalise(candidate))) {
        return { name: candidate, source: "office_code" };
      }
    }
  }
  return null;
}

export function parseDetail(
  html: string,
  knownDistricts: ReadonlySet<string>,
): TenderDetail | null {
  const fields = labelledValues(html);
  const chainRaw = fields.get("Organisation Chain");
  if (chainRaw === undefined || chainRaw.trim() === "") return null;

  const chain = chainRaw
    .split("||")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const department = chain[0];
  if (department === undefined) return null;

  const district = districtFromChain(chain, knownDistricts);
  // "NA" is the portal saying it publishes no figure here. Treating it as text
  // would print the letters N and A where a reader expects a value.
  const stated = (value: string | undefined): string | null =>
    value === undefined || value === "" || value.toUpperCase() === "NA" ? null : value;

  return {
    department,
    organisationChain: chain,
    districtName: district?.name ?? null,
    districtSource: district?.source ?? null,
    location: stated(fields.get("Location")),
    pincode: stated(fields.get("Pincode")),
    tenderCategory: stated(fields.get("Tender Category")),
    productCategory: stated(fields.get("Product Category")),
    tenderType: stated(fields.get("Tender Type")),
    tenderValuePaise: rupeesToPaise(fields.get("Tender Value in ₹")),
    emdPaise: rupeesToPaise(fields.get("EMD Amount in ₹")),
  };
}
