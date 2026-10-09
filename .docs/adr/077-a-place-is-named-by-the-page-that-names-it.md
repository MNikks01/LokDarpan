# ADR-077 · A place is named by the page that names it

**Status:** Accepted · **Date:** 2026-10-09 · **Issue** #203 · **Builds on** ADR-026, ADR-072, ADR-073, ADR-074

## Context

The audit reports are the one deep, publishable source the platform holds. Maharashtra's ten alone
run to 2,792 pages, in Marathi and English. The question a reader brings to them is about a place:
what does the official record say about Gadchiroli, or about Sindewahi taluka? Nothing could answer
it. A report is filed under a state by the publisher's own classification (0027), and the districts
and talukas its pages discuss were never recorded. The owner asked for the reports on the map, as
pins a reader can open, rather than PDFs nobody reads.

Every district and taluka of Maharashtra is now in the ledger (LD-006). A first text search finds
357 pages naming a district, 35 of 36 districts named, and 151 of 355 talukas named somewhere.

## Decision

1. **A place mention is a fact, read as a candidate and decided by a person.** `fact_kind` gains
   `place_reference` (0047). `place_mention` links a reviewed fact to an `admin_unit`. As with
   bodies (ADR-074), nothing is shown from a fact not verified or corrected, from a source the gate
   withholds (ADR-073), or from a scan (ADR-072).
2. **The extractor matches only places the report's own state holds** (`cag/places.ts`). It cannot
   invent a place. It under-reaches on purpose:
   - a taluka whose name another taluka in the state shares is skipped;
   - a taluka named as a district is, is read as the district;
   - names of three letters or fewer are skipped;
   - matching is whole-word and case-sensitive (Title Case or capitals).

   There is one candidate per place per page, written "Gadchiroli district" or "Sindewahi taluka",
   so the reviewer sees the level and can correct it.

3. **It runs inside the main parser run** (`cag-facts/25`), with the state's places passed in. The
   facts loader retires every undecided candidate a run does not produce, so a separate run would
   delete the other's candidates on every pass.
4. **Place names are reviewed by place, not by page** (`review:places`).
   - A figure is its own claim and is checked against its own page.
   - A place name repeated across a report is one claim: that the report uses this word for this
     place. The reviewer is shown each place once, with one sentence from every report that names
     it, and decides for all its pages together.
   - Every page still gets its own decision row, attributed to the reviewer, with a note saying it
     was decided by place, and kept with its history.
   - A place that reads doubtfully is sent to the page-at-a-time queue.
   - This takes Maharashtra's first run from 1,897 decisions to 173.
5. **A pin means "named on these pages", and nothing more.** It does not say the money on those
   pages was spent there, or that the figures are about that place. Every surface says so. There is
   no ranking, no "most audited" view and no warning colour.

## Alternatives considered

- **Page-at-a-time review, as for figures.** This was rejected as the default: 1,897 decisions that
  are mostly the same claim spend a reviewer's attention on repetition, and attention spent there is
  taken from figures. It stays available for any place.
- **One candidate per place per report, as for bodies.** This was rejected. A pin's value is the
  list of pages that name the place; one page per report would hide the rest of what the report says.
- **Geocoding place names against an external service.** This was rejected. The ledger already
  holds every district and taluka with its LGD code and boundary, and an external geocoder would
  add a second, unreviewed notion of where a place is.
- **Pinning figures to places automatically by proximity on the page.** This was rejected for the
  reason ADR-074 gives for bodies: being named near a figure does not make the figure about the
  place.

## Consequences

- Districts renamed since a report was written (Aurangabad, Osmanabad, Ahmednagar) are not matched
  until an alias list, itself reviewed, is added.
- Named facilities ("District Hospital, Gadchiroli") are pinned to their district, not their exact
  site, until they are matched against OpenStreetMap in a later change.
- Production receives place candidates through `promote:cag --refresh`, and mentions through
  `ingest:places`, as it received bodies.
