# ADR-079 · A tender is a record that answers five questions

**Status:** Accepted · **Date:** 2026-10-09 · **Builds on** ADR-049, ADR-056, ADR-067, ADR-073, ADR-078

## Context

The owner wants a tender to read like a place on a map. You pick it and see everything about it:
what is being built, where, who issued it and who won it, how much money, and when. The ledger
held ten columns per tender. The detail page it fetched every night states about seventy-six
fields, and the rest were discarded. Nothing arranged a tender for a person to read. Nothing said
whether an empty field was empty because the portal does not state it, because we had not read it,
or because the portals hide it behind a CAPTCHA.

## Decision

1. **Keep every field the page states** (`tender.detail_fields`, 0048), as label and value, with
   the portal's "NA" dropped. The labels are not typed into columns, because portals word some of
   them differently. `tenders:refill-details` fills tenders collected before 0048 from the pages
   already in the raw store, without fetching anything again.
2. **A tender's record is arranged around five questions** (`@lokdarpan/domain`,
   `tender-record.ts`): what, where, who, how much, and when.
   - Each field is **known**, with its value, or **missing**, with one of six reasons: not on the
     page, page not read yet, award not collected, work site not stated, progress not available, or
     district not established.
   - Award, contract and payment fields are listed even though nothing fills them, so the record
     says plainly that they are not collected and why.
3. **Status comes from dates alone and never says "awarded".** A tender is open until its closing
   date, then "Bids closed on …; whether it was awarded is not known". A passed deadline is not an
   award.
4. **Values are not re-interpreted.**
   - Dates and amounts the page prints as text are shown as printed.
   - Amounts held as paise are shown as decimal rupees in the short form people use, with the exact
     figure beside it.
   - A district LokDarpan worked out is labelled as the issuing office's district, with how it was
     found (ADR-067). It is never shown as the tender's own statement or as the work site.
5. **Written for a person.** The sentences live in `apps/web/src/copy/tender.ts`.
   - The panel leads with the title, where the tender stands, and three facts (estimated cost, last
     day to submit, kind of work).
   - Each section lists what is known.
   - What is missing is gathered into one line per reason at the section's foot, never a column of
     empty rows.
6. **Withheld exactly as before.** `GET /api/v1/tenders/:id` reads nothing the tender says unless
   the gate opens tender details (ADR-073), which it does only on a recorded grant or in the
   operator's private preview (ADR-078). Until then it answers that the tender is held, and links
   to the state's portal.

## Alternatives considered

- **A typed column for every GePNIC label.** This was rejected because labels vary by portal, and a
  label nobody wrote a column for would be lost. JSON keeps the page whole.
- **Hide fields that are always empty (bidders, award, payments).** This was rejected: their absence
  is the most important thing a reader needs to know about the record's limits.
- **Parse printed dates into timestamps.** This was rejected for now, because one mis-read format
  shows a reader a wrong deadline with a correct-looking source.

## Consequences

- When award results or a progress register become collectable, their fields change from missing to
  known, and the record's shape does not change.
- `detail_fields` is not versioned by the tender history trigger (0022); a changed work description
  is not yet kept as a version.
