-- 0007 · Candidate facts extracted from documents.
--
-- This is the most dangerous table in the schema. Its rows are claims about
-- named companies, named officers and public money, derived by pattern
-- matching over audit prose — which will be wrong often enough that publishing
-- unreviewed output would breach the project's own evidence rules
-- (.docs/17-legal/legal-ethical-rules.md).
--
-- So nothing here is a published fact. Rows are *candidates* until a human
-- says otherwise, and the only way to read them for display is the
-- `published_fact` view at the bottom, which cannot return an unverified row.

CREATE TYPE fact_kind AS ENUM (
    'monetary_amount',
    'contractor_reference',
    'officer_role_reference',
    'work_reference'
);

CREATE TYPE verification_status AS ENUM (
    'unverified',
    'verified',
    'rejected',
    'corrected'
);

CREATE TABLE document_fact (
    id                    BIGINT              GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id           BIGINT              NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    -- The citation. A fact without a page is not evidence.
    page_number           INTEGER             NOT NULL CHECK (page_number >= 1),
    kind                  fact_kind           NOT NULL,

    -- The sentence exactly as published, so a reviewer sees the claim in its
    -- own context rather than a fragment the parser found convenient.
    raw_text              TEXT                NOT NULL,
    -- Normalised interpretation: paise for money, trimmed name for a party.
    -- NULL where the parser found a candidate it could not normalise.
    normalised_value      TEXT,

    extraction_method     TEXT                NOT NULL,
    parser_version        TEXT                NOT NULL,
    -- Deliberately not defaulted. A parser that omits its confidence should
    -- fail to insert, not silently claim certainty.
    extraction_confidence NUMERIC(4,3)        NOT NULL
        CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),

    verification_status   verification_status NOT NULL DEFAULT 'unverified',
    verified_by           TEXT,
    verified_at           TIMESTAMPTZ,
    -- What the reviewer corrected it to, where they did.
    corrected_value       TEXT,
    reviewer_note         TEXT,

    CONSTRAINT document_fact_raw_not_blank CHECK (length(btrim(raw_text)) > 0),
    -- A verified or rejected row must say who decided and when. Without that
    -- the audit trail is a claim about a review that may never have happened.
    CONSTRAINT document_fact_review_attributed CHECK (
        verification_status = 'unverified'
        OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)
    ),
    -- 'corrected' means the reviewer supplied a different value; without one
    -- the status is meaningless.
    CONSTRAINT document_fact_correction_present CHECK (
        verification_status <> 'corrected' OR corrected_value IS NOT NULL
    )
);

CREATE INDEX document_fact_document_idx ON document_fact (document_id, page_number);
CREATE INDEX document_fact_kind_idx     ON document_fact (kind, verification_status);

COMMENT ON TABLE document_fact IS
    'Candidate extractions. Not published facts. Read published_fact for display.';

-- ---------------------------------------------------------------------------
-- The only readable surface for display.
--
-- A reviewer's correction wins over the parser's reading, and a rejected or
-- unverified candidate is not here at all. Serving from this view rather than
-- the table is what makes "no unreviewed claim reaches a reader" a property of
-- the schema instead of a rule someone has to remember.
-- ---------------------------------------------------------------------------
CREATE VIEW published_fact AS
SELECT
    f.id,
    f.document_id,
    f.page_number,
    f.kind,
    f.raw_text,
    COALESCE(f.corrected_value, f.normalised_value) AS value,
    f.verification_status,
    f.verified_by,
    f.verified_at,
    d.title        AS document_title,
    s.source_url,
    s.retrieved_at
FROM document_fact f
JOIN document d        ON d.id = f.document_id
JOIN source_artifact s ON s.sha256 = d.source_sha256
WHERE f.verification_status IN ('verified', 'corrected');

COMMENT ON VIEW published_fact IS
    'Human-reviewed facts only, each carrying its document, page and source URL.';
