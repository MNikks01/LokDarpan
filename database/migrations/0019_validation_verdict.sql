-- What the field's own rules could establish about a reading, before anyone read it.
--
-- Three states, deliberately separate from the four `verification_status`
-- records. That column is what a *person* decided; this is what the extractor
-- determined. Keeping them apart is the point: a machine that could set
-- `verified` would be a machine publishing government figures.
--
-- The verdict is **advisory**. A `rejected` verdict does not remove the value
-- and does not withhold the fact. Sweeping these rules across the 5,102 figures
-- already published found 129 they disagree with, of which 113 are rates a
-- reviewer chose to publish — "₹1,500 per month", "₹1,000 per instance",
-- "₹3,650 per square meter". Whether those belong in a ledger that models
-- amounts is a question about the standard, and not one a regular expression
-- should settle by unpublishing a government figure.
--
-- So it is recorded, surfaced to the reviewer, and left there.

ALTER TABLE document_fact
    ADD COLUMN validation_state TEXT,
    ADD COLUMN validation_reason TEXT;

ALTER TABLE document_fact
    ADD CONSTRAINT document_fact_validation_state_known
        CHECK (validation_state IS NULL
               OR validation_state IN ('accepted', 'needs_review', 'rejected'));

-- A refusal has to say why. "The machine disagreed" is not a reason a reviewer
-- can act on, and an unexplained flag is one people learn to ignore.
ALTER TABLE document_fact
    ADD CONSTRAINT document_fact_validation_refusal_is_explained
        CHECK (validation_state <> 'rejected'
               OR (validation_reason IS NOT NULL AND length(btrim(validation_reason)) > 0));

CREATE INDEX document_fact_validation_state_idx
    ON document_fact (validation_state)
    WHERE validation_state = 'rejected';

COMMENT ON COLUMN document_fact.validation_state IS
    'What the extractor established: accepted, needs_review or rejected. Advisory — a person still decides, in verification_status.';
COMMENT ON COLUMN document_fact.validation_reason IS
    'Why the extractor rejected the reading, in the terms a reviewer would use. Required when validation_state is rejected.';
