-- What a figure is *per*, so a rate can be published as the rate it is.
--
-- ADR-044 withheld 118 published rates on one ground: `document_fact` had no
-- denominator, so a page rendered ₹15 where the source says ₹15 per record. A
-- figure that cannot say what it is per misstates itself.
--
-- This is the column that ends that. It holds the denominator worded as the
-- page words it — "month", "record", "IPD patient per day", "Cu.M." — read
-- forward from the figure and never inferred. Where the sentence states a rate
-- whose denominator cannot be read whole, the value is still refused: a unit
-- guessed from the surrounding nouns would be a denominator this project
-- invented, which is the one thing it may not do to a government figure.
--
-- NULL means the figure is not a rate. Empty is not a denominator, and the
-- constraint says so.

ALTER TABLE document_fact
    ADD COLUMN per_unit TEXT;

ALTER TABLE document_fact
    ADD CONSTRAINT document_fact_per_unit_is_stated
        CHECK (per_unit IS NULL OR length(btrim(per_unit)) > 0);

COMMENT ON COLUMN document_fact.per_unit IS
    'What this figure is per, worded as the page words it. NULL where the figure is not a rate. A rate whose denominator could not be read carries no value at all rather than a value without its unit.';

-- The view gains it too: a reader is shown the rate or is shown nothing.
DROP VIEW published_fact;

CREATE VIEW published_fact AS
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
  AND COALESCE(f.corrected_value, f.normalised_value) IS NOT NULL;
