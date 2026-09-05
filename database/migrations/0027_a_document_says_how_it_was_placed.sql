-- 0027 · How a document came to be filed under a place.
--
-- THE DISTINCTION THIS MAKES VISIBLE
-- `document.admin_unit_id` has always held a unit and never held an account of
-- why. Every one of the thirty audit reports we hold points at a state, and
-- nothing in the schema said whether that means "this report is about
-- Maharashtra" or "we filed it under Maharashtra because that is the filter we
-- fetched it with". Those are different claims, and only the second is true.
--
-- The tender table already draws exactly this line. `tender.district_source`
-- separates `chain_unit` — a segment of the organisation chain that IS that
-- district — from `office_code`, a name found inside an office name whose reach
-- is wider. The same discipline is applied here rather than a second idea about
-- provenance.
--
-- WHY THE ISSUING OFFICE IS NOT THE ANSWER
-- A report titled "Nagpur Report No. 2 of 2026" was issued by the Accountant
-- General's office at Nagpur. That office audits across the state. Reading the
-- title as a district would file state-wide findings under one district and put
-- a claim about Nagpur's administration on the page with nothing behind it.
-- No such attribution is created here, and none may be created from a title.

ALTER TABLE document
    ADD COLUMN geography_source TEXT;

COMMENT ON COLUMN document.geography_source IS
'How admin_unit_id was arrived at. publisher_filter means the publisher''s own classification placed it, which is weaker than the document establishing the geography it audits.';

-- The one basis we actually have. CAG's site is filtered by state, and the
-- filter used is what put each report under a state — the publisher's own
-- classification of its own report, which is evidence, and is not evidence of
-- anything narrower than a state.
--
-- A stronger basis, where a document states the geography it audits, would be a
-- new value and a new migration. Adding one now that nothing writes would be
-- inventing a category before there is anything to put in it.
ALTER TABLE document
    ADD CONSTRAINT document_geography_source_known CHECK (
        geography_source IS NULL OR geography_source IN ('publisher_filter')
    );

UPDATE document SET geography_source = 'publisher_filter'
 WHERE admin_unit_id IS NOT NULL AND geography_source IS NULL;

-- A placement must say how it was reached. Without this a row could carry a
-- unit with no account of where it came from, and a weak basis would be
-- indistinguishable from a strong one.
ALTER TABLE document
    ADD CONSTRAINT document_geography_source_present CHECK (
        admin_unit_id IS NULL OR geography_source IS NOT NULL
    );
