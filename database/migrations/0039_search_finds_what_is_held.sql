-- 0039 · Search finds what is held, by an index rather than a scan.
--
-- WHAT WAS WRONG
-- `/api/v1/search` matched `ILIKE '%term%'` over place names and document
-- titles, with no index that could serve it: every search read every row. It
-- could not find a report by what the report says, only by its title, and a
-- verified figure not at all. The one full-text index that existed
-- (`document_page_fts_idx`, 0006) used the `english` configuration, which stems
-- English and does nothing useful for Devanagari — and no query used it.
--
-- WHAT THIS ADDS
-- - Trigram indexes on place names (English and local script) and document
--   titles. They serve `ILIKE '%term%'` and the `%` similarity operator, so a
--   substring or a near-miss spelling ("Nagpure", "Chattisgarh") is found
--   without a scan.
-- - Page text indexed with the `simple` configuration: split on spaces and
--   punctuation, lower-cased, never stemmed. It treats Marathi, Hindi and
--   English alike, and a reader's exact words are matched as written.
-- - The evidence sentence of every figure a person has verified, indexed the
--   same way — only those, because only those can be shown.
--
-- Tender titles are not indexed: their details are withheld until the issuing
-- departments permit republication (ADR-056), and search must not reveal what a
-- page may not show.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX admin_unit_name_en_trgm_idx ON admin_unit USING GIN (name_en gin_trgm_ops);
CREATE INDEX admin_unit_name_local_trgm_idx ON admin_unit USING GIN (name_local gin_trgm_ops)
    WHERE name_local IS NOT NULL;
CREATE INDEX document_title_trgm_idx ON document USING GIN (title gin_trgm_ops);

DROP INDEX IF EXISTS document_page_fts_idx;
CREATE INDEX document_page_simple_fts_idx ON document_page
    USING GIN (to_tsvector('simple', coalesce(content, '')));

CREATE INDEX document_fact_published_fts_idx ON document_fact
    USING GIN (to_tsvector('simple', raw_text))
    WHERE verification_status IN ('verified', 'corrected');
