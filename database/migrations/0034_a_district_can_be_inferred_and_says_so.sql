-- 0034 · A tender's district can be inferred, and says how.
--
-- Until now a tender was placed only when its organisation chain named a
-- district (`chain_unit`) or an office name did (`office_code`). Most tenders
-- in the north-eastern states name neither, and stayed unplaced. Two further
-- routes are added, each weaker than the chain and each recorded as such:
--
--   pincode     the tender's printed pincode, looked up in the Department of
--               Posts' directory, where every office under that pincode sits in
--               one district of the tender's state
--   place_name  the tender's printed location matches exactly one post office
--               name in that directory, within the tender's state
--   manual      a person decided, for a tender no rule could place
--
-- ORDER: explicit district → pincode → place name → unresolved. The resolver
-- (services/ingestion/src/gepnic/resolve.ts) stops at the first that answers.
--
-- WHAT A PLACEMENT NOW RECORDS
--   district_source           the method, as before
--   linkage_confidence        the confidence, as before
--   district_evidence_sha256  the reference artefact an inference was read
--                             from; NULL for chain_unit and office_code, whose
--                             evidence is the tender's own page (source_sha256)
--   district_evidence_key     what was matched — the pincode, or the office name
--   district_resolved_at      when the placement was made. NULL for placements
--                             made before this migration: that time was not
--                             recorded, and inventing one would be worse.
--
-- An inferred placement without its evidence cannot be written. The reader is
-- told which kind of placement they are looking at (ADR-067).

CREATE TABLE pincode_office (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pincode CHAR(6) NOT NULL,
    office_name TEXT NOT NULL,
    office_type TEXT,
    -- As the directory spells them. Resolved to the ledger's districts by
    -- `districtKey` within one state, never across states.
    district_name TEXT NOT NULL,
    state_name TEXT NOT NULL,
    source_sha256 TEXT NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_version (id),

    CONSTRAINT pincode_office_pincode_shape CHECK (pincode ~ '^[1-9][0-9]{5}$'),
    CONSTRAINT pincode_office_identity UNIQUE (pincode, office_name, district_name)
);

CREATE INDEX pincode_office_pincode_idx ON pincode_office (pincode);
CREATE INDEX pincode_office_state_idx ON pincode_office (lower(state_name));

COMMENT ON TABLE pincode_office IS
    'Department of Posts all-India pincode directory (data.gov.in, GODL-India). Reference data for inferring a tender''s district; never shown as a tender''s own statement.';

ALTER TABLE tender
    DROP CONSTRAINT tender_district_source_known,
    ADD CONSTRAINT tender_district_source_known CHECK (
        district_source IS NULL
        OR district_source IN ('chain_unit', 'office_code', 'pincode', 'place_name', 'manual')
    ),
    ADD COLUMN district_evidence_sha256 TEXT REFERENCES source_artifact (sha256),
    ADD COLUMN district_evidence_key TEXT,
    ADD COLUMN district_resolved_at TIMESTAMPTZ,
    ADD CONSTRAINT tender_inferred_district_has_evidence CHECK (
        district_source IS NULL
        OR district_source NOT IN ('pincode', 'place_name')
        OR (district_evidence_sha256 IS NOT NULL AND district_evidence_key IS NOT NULL)
    );

COMMENT ON COLUMN tender.district_source IS
    'How the district was reached: chain_unit (a chain segment is that district), office_code (inside an office name), pincode or place_name (inferred from the Department of Posts directory), manual (a person decided).';
COMMENT ON COLUMN tender.district_evidence_sha256 IS
    'The reference artefact an inferred district was read from. NULL when the evidence is the tender''s own page.';
COMMENT ON COLUMN tender.district_evidence_key IS
    'What was matched for an inferred district: the pincode, or the office name.';
COMMENT ON COLUMN tender.district_resolved_at IS
    'When the placement was made. NULL for placements made before migration 0034.';

-- The scheduled collector resolves against the directory; it never writes it.
-- The directory is loaded by an operator as the owner, like the LGD hierarchy.
GRANT SELECT ON pincode_office TO lokdarpan_etl;
