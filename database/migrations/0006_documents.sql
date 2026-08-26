-- 0006 · The document repository.
--
-- Government facts about execution — contractor, contract value, responsible
-- officer — exist in published PDFs, not in any queryable register
-- (.docs/06-government-sources/data-availability-matrix.md). Citing them means
-- pointing at a page, so pages are stored, not just documents.
--
-- The original bytes are never modified. They live in the content-addressed raw
-- store; `source_sha256` is the link, and re-extraction with a better parser
-- must always be possible from what was actually retrieved.

CREATE TYPE document_type AS ENUM (
    'audit_report',
    'government_resolution',
    'tender_notice',
    'award_of_contract',
    'work_order',
    'completion_certificate',
    'other'
);

/** Which script a page is written in. CAG reports are bilingual. */
CREATE TYPE page_script AS ENUM ('latin', 'devanagari', 'mixed', 'none');

CREATE TABLE document (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_sha256       CHAR(64)      NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id  BIGINT        NOT NULL REFERENCES dataset_version (id),

    doc_type            document_type NOT NULL,
    title               TEXT          NOT NULL,
    issuing_authority   TEXT,
    -- NULL where the document does not state a date. Never inferred from the
    -- retrieval time: when we fetched a report says nothing about when it was
    -- laid before the legislature.
    published_on        DATE,
    admin_unit_id       BIGINT        REFERENCES admin_unit (id),

    mime_type           TEXT          NOT NULL,
    page_count          INTEGER       NOT NULL CHECK (page_count >= 0),
    /** Pages that yielded no text and would need OCR to be readable. */
    pages_without_text  INTEGER       NOT NULL CHECK (pages_without_text >= 0),
    extraction_method   TEXT          NOT NULL,

    CONSTRAINT document_one_per_artifact UNIQUE (source_sha256),
    CONSTRAINT document_title_not_blank  CHECK (length(btrim(title)) > 0),
    CONSTRAINT document_pages_consistent CHECK (pages_without_text <= page_count)
);

COMMENT ON COLUMN document.published_on IS
    'As stated by the document. NULL when it states none — never the retrieval date.';

CREATE INDEX document_type_idx ON document (doc_type);
CREATE INDEX document_unit_idx ON document (admin_unit_id);

CREATE TABLE document_page (
    id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id  BIGINT      NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    -- 1-based, matching how a citation is written and how a reader counts.
    page_number  INTEGER     NOT NULL CHECK (page_number >= 1),
    -- NULL where the page yielded no text at all. An empty string would claim
    -- the page is blank; NULL says we could not read it.
    content      TEXT,
    script       page_script NOT NULL,

    CONSTRAINT document_page_unique UNIQUE (document_id, page_number),
    CONSTRAINT document_page_content_not_empty CHECK (content IS NULL OR length(content) > 0)
);

COMMENT ON COLUMN document_page.content IS
    'NULL means no text was extracted — the page may be an image needing OCR. Not the same as blank.';

-- Full-text search over page content, so a citation can be found by its words.
CREATE INDEX document_page_fts_idx ON document_page
    USING GIN (to_tsvector('english', coalesce(content, '')));
