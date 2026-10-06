-- 0043 · A fact read from a scan names the reading it was read from.
--
-- WHY
-- ADR-071 stores an OCR engine's reading beside the page and left one question
-- open: whether a reading may yield a fact. ADR-072 answers it — yes, as a
-- candidate a person must check, never as a fact the ledger asserts. A
-- candidate from a reading is a different claim from one read out of the
-- publisher's own text layer: the words are an engine's guess at the ink.
-- Telling the two apart by `extraction_method` alone would leave it to every
-- reader of the table to parse a string, and to every future surface to
-- remember to.
--
-- WHAT THIS DOES
-- · `document_fact.page_reading_id` names the reading a fact was read from.
--   NULL for every fact read from a text layer, which is every fact so far.
--   A reading's facts go with it: deleting a reading deletes what was read
--   from it, decided or not, because a decision about a reading that no
--   longer exists is a decision about nothing anyone can re-check.
-- · The reading must be of the same page the fact cites. Checked by the
--   foreign key itself: a reading is identified by its document and page.
-- · `published_fact` withholds facts read from a scan, even verified ones,
--   until a surface can say so to a reader (ADR-072). The view is the only
--   thing the site reads facts from; withholding here is withholding
--   everywhere.

ALTER TABLE page_reading
    ADD CONSTRAINT page_reading_id_of_its_page UNIQUE (id, document_id, page_number);

ALTER TABLE document_fact
    ADD COLUMN page_reading_id BIGINT,
    ADD CONSTRAINT document_fact_read_from_its_page_reading
        FOREIGN KEY (page_reading_id, document_id, page_number)
        REFERENCES page_reading (id, document_id, page_number) ON DELETE CASCADE;

CREATE INDEX document_fact_page_reading_idx
    ON document_fact (page_reading_id) WHERE page_reading_id IS NOT NULL;

COMMENT ON COLUMN document_fact.page_reading_id IS
    'The OCR reading this fact was read from (ADR-072), or NULL for a fact read from the document''s own text layer. A fact read from a scan is withheld from published_fact.';

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
    s.retrieved_at
FROM document_fact f
JOIN document d        ON d.id = f.document_id
JOIN source_artifact s ON s.sha256 = d.source_sha256
WHERE f.verification_status IN ('verified', 'corrected')
  AND COALESCE(f.corrected_value, f.normalised_value) IS NOT NULL
  AND f.page_reading_id IS NULL;
