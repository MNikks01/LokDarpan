-- 0044 · A fact read from a scan says how legible its figures were, and is shown as one.
--
-- WHY
-- ADR-072 withheld every fact read from a scan until a reader could be told
-- three things beside it: that it was read by text recognition, by which
-- engine, and how clearly the engine could see the characters. The wording
-- exists (`apps/web/src/copy/figures.ts`, `scanFactCopy`). What was missing was
-- the engine's own confidence: `extraction_confidence` is the parser's
-- confidence times the engine's, and the engine's part cannot be divided back
-- out of a rounded product.
--
-- WHAT THIS DOES
-- · `document_fact.reading_confidence` is the engine's least confidence among
--   the words of the value — not of the label the pattern matched. NULL for a
--   fact read from a text layer, and only such a fact.
-- · `published_fact` gains the reading's engine, its version and that
--   confidence, so a page or an API answer cannot show a scan fact without
--   what makes it one. The view's existing columns are unchanged; the new ones
--   come last, which is what CREATE OR REPLACE VIEW allows.
-- · A verified fact read from a scan is published only once it carries its
--   reading confidence. One read before this migration has none until the
--   parser runs again, and stays withheld until then rather than shown with a
--   legibility nobody measured.

ALTER TABLE document_fact
    ADD COLUMN reading_confidence NUMERIC(4, 3)
        CHECK (reading_confidence >= 0 AND reading_confidence <= 1),
    ADD CONSTRAINT document_fact_reading_confidence_of_a_reading
        CHECK (reading_confidence IS NULL OR page_reading_id IS NOT NULL);

COMMENT ON COLUMN document_fact.reading_confidence IS
    'For a fact read from a scan: the OCR engine''s least confidence among the words of the value (ADR-072). NULL for a fact read from a text layer.';

CREATE OR REPLACE VIEW published_fact AS
SELECT
    f.id,
    f.document_id,
    f.page_number,
    f.kind,
    f.raw_text,
    COALESCE(f.corrected_value, f.normalised_value) AS value,
    f.per_unit,
    f.verification_status,
    f.verified_by,
    f.verified_at,
    f.reviewer_note,
    (SELECT count(*) FROM document_fact_review_history h
      WHERE h.document_fact_id = f.id) AS revision_count,
    d.title        AS document_title,
    s.source_url,
    s.retrieved_at,
    r.engine         AS reading_engine,
    r.engine_version AS reading_engine_version,
    f.reading_confidence
FROM document_fact f
JOIN document d        ON d.id = f.document_id
JOIN source_artifact s ON s.sha256 = d.source_sha256
LEFT JOIN page_reading r ON r.id = f.page_reading_id
WHERE f.verification_status IN ('verified', 'corrected')
  AND COALESCE(f.corrected_value, f.normalised_value) IS NOT NULL
  AND (f.page_reading_id IS NULL OR f.reading_confidence IS NOT NULL);
