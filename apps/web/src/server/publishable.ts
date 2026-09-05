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
