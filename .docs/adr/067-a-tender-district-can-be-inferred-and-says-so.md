# ADR-067 · A tender's district can be inferred, and says so

**Status:** Accepted · **Date:** 2026-09-25 · **Extends** the placement rules of
[`../../services/ingestion/src/gepnic/detail.ts`](../../services/ingestion/src/gepnic/detail.ts)
(`districtFromChain`) · **Migration:** `0034_a_district_can_be_inferred_and_says_so.sql`

## Context

A tender is placed on the map only when its organisation chain names a district. On the first
production collection, 213 of 353 tenders stayed unplaced, most in the north-eastern states, whose
chains name only state-level offices, circles or towns. Many of those tenders do print a pincode or
a town. The decision of 2026-09-25 was to resolve districts through authoritative reference data,
in a fixed order, recording how each was reached, and never to present an inferred district as the
tender's own statement.

## Decision

**A fixed order, not a score.** Explicit district (`chain_unit`, then `office_code`) → pincode →
place name → unresolved. The first rule that answers wins
(`services/ingestion/src/gepnic/resolve.ts`).

**The reference is the Department of Posts' pincode directory** on data.gov.in (GODL-India),
loaded into `pincode_office`. See
[`../06-government-sources/pincode-directory-findings.md`](../06-government-sources/pincode-directory-findings.md).

**Every inference is unanimous and within one state.** A pincode whose offices sit in two districts,
or a place name that is an office in two districts, places nothing. The directory's district must
resolve, by `districtKey`, to one of the ledger's districts of the portal's own state; a spelling
the ledger does not hold places nothing. Place names are compared with vowels kept and must be at
least five letters, because thousands of post offices collide far more readily than a state's few
dozen districts.

**Confidence:** `chain_unit` 0.9 · `office_code` 0.6 · `pincode` 0.6 · `place_name` 0.4. A pincode
is the delivery area of the issuing office's address, which is usually but not necessarily the work
site.

**Each placement records** method (`district_source`), confidence (`linkage_confidence`), the
reference artefact (`district_evidence_sha256`), what was matched (`district_evidence_key`) and
when (`district_resolved_at`). The database refuses an inferred placement without its evidence.
The six columns move together on re-sighting: a new placement replaces all of them and no
placement keeps all of them, so an explicit district never keeps an old inference's evidence.

**The reader is told.** A tender placed by inference reads "Not named by the issuing office.
Inferred from its pincode 605602, which the Department of Posts lists only in this district." The
map's summary says how many shaded tenders were inferred. The wording lives in
`apps/web/src/copy/data-state.ts`.

**Unresolved goes to review.** `tenders:resolve` re-resolves held tenders still unplaced and lists
what remains with the chain, location and pincode a person would read. A `manual` method exists in
the schema for a review tool that records who decided; that tool is not built.

## Consequences

- **Nothing is inferred yet in production.** The directory is not loaded: its API needs a key
  issued to a registered data.gov.in account, and `data.gov.in`'s `robots.txt` rules out fetching
  its files by program. Once a key exists, `ingest:pincodes -- --api` loads it and
  `tenders:resolve` backfills.
- Placements made before migration 0034 have no `district_resolved_at`: that time was not recorded,
  and it is left null rather than invented.
- A town/village step from LGD or the Department of Posts' 2016 locality edition is the next
  candidate; it is not built.
- Some unplaced tenders name their district in a form `districtKey` does not reach (a chain naming
  "Kanpur" where the ledger holds "Kanpur Nagar"). That is the explicit step's gap, separate from
  inference, and unchanged here.

## Addendum · 2026-09-29 — the location step

The review list (`tenders:review`) showed that many tenders the chain cannot place state their
district in the location field: "Kokrajhar", "Nalbari, Belsor", "Sepahijala District". The order is
now **chain → location names a district → pincode → place name → unresolved**. It is the
town/village/admin step of the 25 September decision, taken from the tender's own text, so it needs
no reference data and runs before the directory exists.

- A tender is placed only when its location names **exactly one** district of the portal's state.
  Each comma-, slash- or bracket-separated piece is compared whole: exactly with vowels kept, or
  vowel-less only on a piece of six letters or more, because "Singa" and "Siang" collide otherwise.
  The review list's hints use the same matcher, so a hint and a placement cannot disagree.
- Method `location_district` (migration 0036), confidence **0.7**: the tender's own text, and more
  often the work site than the issuing office is, but free text rather than a district field. The
  location text is the evidence key. The chain still wins where it names a district; the location
  wins over a pincode.
- The reader sees: "The tender's location, “Nalbari, Belsor”, names this district; the issuing
  office's name does not." It counts among the tenders the map says the office did not name.
- Measured on the local ledger: **44 of 289** unplaced tenders placed. Every one was checked by hand
  against its location and chain.
- **Corrected the same day.** In production the step placed 209 tenders; checked by hand, one was
  wrong. "Rangpo, Kitchudumra Namchi, Gyalshing, Kewzing" names Namchi inside a longer piece as well
  as Gyalshing, and was placed in Gyalshing alone. A district now also counts when a single word is
  its exact name, but only to **refuse**: a placement needs one district from whole pieces and no
  other anywhere in the text. Re-read with the fix, the other 208 are unchanged; the one was
  unplaced.
