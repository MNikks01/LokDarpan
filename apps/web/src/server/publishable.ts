/**
 * Which sources may be shown to a reader, and which may only be held.
 *
 * The three sources this project uses do not carry the same terms, and the
 * difference is not cosmetic:
 *
 * - **CAG** and **LGD** permit reproduction outright, with prominent
 *   attribution and no permission needed.
 * - **BEAMS** — the Maharashtra treasury system — permits reproduction
 *   "after taking proper permission by sending a mail to us". Permission has
 *   not been sought, so its figures are not published.
 *
 * See `.docs/06-government-sources/source-licences.md` for the clauses, each
 * fetched and quoted rather than summarised.
 *
 * **This withholds display, not collection.** BEAMS is still ingested, and its
 * figures are still what the consistency checks compare a CAG figure against —
 * a comparison a reader never sees is still a comparison that catches an error.
 * What is withheld is the rendering.
 */

/**
 * Whether the treasury figures may be rendered.
 *
 * Off unless the environment says otherwise, and deliberately not a build-time
 * constant: the day permission arrives, this becomes true without a code change,
 * and until then no deployment can publish those figures by forgetting a flag.
 */
export function treasuryFiguresArePublishable(): boolean {
  return process.env["PUBLISH_BEAMS_FIGURES"] === "true";
}

/**
 * Whether tender details may be rendered: titles, references, values, EMDs,
 * organisation chains and locations.
 *
 * Every GePNIC portal we collect permits reproduction "after taking proper
 * permission from the respective Organisation / Department" (Madhya Pradesh: in
 * writing), the clause BEAMS is withheld under. Permission has not been sought,
 * so details are withheld and the reader is linked to the state's portal, which
 * the same terms allow without asking (`source-licences.md` §5, ADR-056).
 *
 * Counts and district shading stay: they are computed by LokDarpan, not
 * reproduced from a portal. Read at call time, and only the exact string
 * "true" opens it, for the same reasons as `treasuryFiguresArePublishable`.
 */
export function tenderDetailsArePublishable(): boolean {
  return process.env["PUBLISH_TENDER_DETAILS"] === "true";
}
