-- 0048 · A tender keeps every field its page states.
--
-- WHY
-- A GePNIC detail page states around seventy-six labelled fields. The collector
-- kept ten as columns (0018, 0038) and discarded the rest, so the work
-- description, the tender fee, the period of work, the pre-bid meeting and the
-- document dates were fetched every night and thrown away. A tender's record
-- (ADR-079) needs them.
--
-- They are kept as the page states them, label and value, in one JSON object:
-- portals word some labels differently, and typing each into a column would
-- lose whatever a column was not written for. The record reads the labels it
-- knows; an unknown label costs one empty field, never a wrong one.
--
-- `detail_sha256` already cites the page they were read from, so every value
-- here has its source. Withheld exactly as the other detail columns are: only
-- what the publication gate permits is ever read out (ADR-056, ADR-073).

ALTER TABLE tender ADD COLUMN detail_fields JSONB;

ALTER TABLE tender ADD CONSTRAINT tender_detail_fields_is_object
    CHECK (detail_fields IS NULL OR jsonb_typeof(detail_fields) = 'object');

COMMENT ON COLUMN tender.detail_fields IS
    'Every label → value the detail page (detail_sha256) states, as stated, with "NA" dropped (0048).';
