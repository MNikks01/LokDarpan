-- 0036 · A tender's location can name its district.
--
-- Many tenders the chain cannot place put the district straight into their
-- location field: "Kokrajhar", "Nalbari, Belsor", "Sepahijala District". The
-- resolver now reads that, after the chain and before the pincode, placing a
-- tender only when its location names exactly one district of the portal's
-- state, matched with vowels kept or on a word long enough to trust (ADR-067,
-- addendum of 2026-09-29).
--
-- It is recorded as its own method so a reader is told where the district came
-- from, with the matched location text as the evidence key. No reference
-- artefact is involved: the evidence is the tender's own page.

ALTER TABLE tender
    DROP CONSTRAINT tender_district_source_known,
    ADD CONSTRAINT tender_district_source_known CHECK (
        district_source IS NULL
        OR district_source IN (
            'chain_unit', 'office_code', 'location_district', 'pincode', 'place_name', 'manual'
        )
    );

COMMENT ON COLUMN tender.district_source IS
    'How the district was reached: chain_unit (a chain segment is that district), office_code (inside an office name), location_district (the location names it), pincode or place_name (inferred from the Department of Posts directory), manual (a person decided).';
