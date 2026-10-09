-- 0047 · A place is named by the page that names it.
--
-- WHY
-- The audit reports run to thousands of pages, and the question a reader brings
-- to them is about a place: what does the record say about Gadchiroli? Nothing
-- in the ledger could answer it. A report is filed under a state by the
-- publisher's own classification (0027), and the districts and talukas its
-- pages discuss were never recorded (#203).
--
-- A place is not created here: every district and taluka already exists in
-- `admin_unit`. What is added is the link from a page to a place it names, read
-- as a candidate and decided by a person, like every figure and every body
-- (ADR-074, ADR-077).
--
-- WHAT THIS ADDS
-- · `fact_kind` gains `place_reference`: a district or taluka named on a page.
--   PostgreSQL will not use a new enum value in the transaction that adds it,
--   so nothing is written with it here (as 0041, 0045).
-- · `place_mention`: the reviewed facts that name a place. A mention whose fact
--   is no longer verified or corrected is not shown, so a reviewer's rejection
--   removes it from view without anyone deleting a row.
--
-- WHAT THIS DOES NOT CLAIM
-- A mention says a page names the place. It does not say the page's figures
-- were spent there, or are about that place, and no surface may present them so.
-- A pin on the map means "named on these pages", nothing more.

ALTER TYPE fact_kind ADD VALUE IF NOT EXISTS 'place_reference';

CREATE TABLE place_mention (
    admin_unit_id      BIGINT NOT NULL REFERENCES admin_unit (id) ON DELETE CASCADE,
    -- A reading deleted with its document takes its mentions with it.
    document_fact_id   BIGINT NOT NULL REFERENCES document_fact (id) ON DELETE CASCADE,
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_version (id),
    PRIMARY KEY (admin_unit_id, document_fact_id)
);

COMMENT ON TABLE place_mention IS
    'A reviewed fact naming a district or taluka. It cites the page; it does not place that page''s figures there (ADR-077).';

CREATE INDEX place_mention_fact_idx ON place_mention (document_fact_id);

-- No grant to lokdarpan_etl, as 0045: mentions are loaded by hand from
-- reviewed facts. lokdarpan_readonly reads the table through its default
-- privileges (0002).
