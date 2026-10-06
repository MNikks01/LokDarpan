-- 0042 · A page read by an engine says which engine read it.
--
-- WHY
-- ADR-038 built the OCR boundary and left one question open on purpose: how a
-- reading enters the ledger. ADR-071 answers it. A reading is stored beside the
-- page, never in place of its text:
--
-- · `document_page.content` stays what the file itself states. For a scan
--   that is NULL, and it stays NULL; `pages_without_text` is unchanged. Writing
--   an engine's guess there would make a scan indistinguishable from a page
--   whose text the publisher typed.
-- · Every reading names its engine, the engine's exact version, the models it
--   used, the languages it was told to read and the render it was taken from.
--   A reading without that provenance cannot be reproduced, so it cannot be
--   stored.
-- · Two engines reading one page are two rows. Nothing is merged and there is
--   nowhere to put a merged reading (ADR-038: disagreement is evidence for a
--   person, not noise to average away).
-- · An absence is stated. An engine that refused a page — not installed, the
--   page would not render — leaves a row with its reason and no content. A
--   reading that found no text leaves a row with empty content. Neither is the
--   same as a page nobody tried to read, which has no row at all.

CREATE TABLE page_reading (
    id                 BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id        BIGINT        NOT NULL,
    page_number        INTEGER       NOT NULL,
    contract_version   TEXT          NOT NULL,
    engine             TEXT          NOT NULL,

    -- The reading's provenance. All of it, or (for a refusal) none of it.
    engine_version     TEXT,
    model_versions     JSONB,
    languages          TEXT[],
    dpi                INTEGER       CHECK (dpi > 0),
    raster_width       INTEGER       CHECK (raster_width > 0),
    raster_height      INTEGER       CHECK (raster_height > 0),
    page_width         NUMERIC(9, 3) CHECK (page_width > 0),
    page_height        NUMERIC(9, 3) CHECK (page_height > 0),
    rotation           SMALLINT      CHECK (rotation IN (0, 90, 180, 270)),

    -- What the engine saw, in reading order. '' when it found no text.
    content            TEXT,
    -- Why the engine read nothing, when it did not try or could not finish.
    refusal            TEXT,

    read_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    dataset_version_id BIGINT        NOT NULL REFERENCES dataset_version (id),

    CONSTRAINT page_reading_of_a_page
        FOREIGN KEY (document_id, page_number)
        REFERENCES document_page (document_id, page_number) ON DELETE CASCADE,
    CONSTRAINT page_reading_content_or_refusal CHECK ((content IS NULL) <> (refusal IS NULL)),
    CONSTRAINT page_reading_refusal_has_a_reason CHECK (refusal IS NULL OR length(btrim(refusal)) > 0),
    CONSTRAINT page_reading_provenance_complete CHECK (
        refusal IS NOT NULL
        OR (engine_version IS NOT NULL AND model_versions IS NOT NULL AND languages IS NOT NULL
            AND dpi IS NOT NULL AND raster_width IS NOT NULL AND raster_height IS NOT NULL
            AND page_width IS NOT NULL AND page_height IS NOT NULL AND rotation IS NOT NULL)
    )
);

-- One reading per page per engine configuration: a re-run with the same engine,
-- version, languages and resolution is the same reading and is not stored twice.
-- A new engine version is a new reading, kept beside the old one.
CREATE UNIQUE INDEX page_reading_once
    ON page_reading (document_id, page_number, engine, engine_version, languages, dpi)
    WHERE refusal IS NULL;

-- At most one standing refusal per page and engine. A later attempt replaces it.
CREATE UNIQUE INDEX page_reading_refused_once
    ON page_reading (document_id, page_number, engine)
    WHERE refusal IS NOT NULL;

COMMENT ON TABLE page_reading IS
    'An OCR engine''s reading of a page, kept beside the page and never in place of its text (ADR-071). A witness, not an authority (ADR-038).';

-- The words of a reading, in the shape `document_text_item` stores for a text
-- layer — a character span and a box in PDF points, origin bottom-left, in the
-- page's unrotated space — so a figure found in a reading is located by the
-- same code. The engine's confidence stays with the word it was given for.
CREATE TABLE page_reading_item (
    reading_id  BIGINT        NOT NULL REFERENCES page_reading (id) ON DELETE CASCADE,
    seq         INTEGER       NOT NULL CHECK (seq >= 0),
    char_start  INTEGER       NOT NULL CHECK (char_start >= 0),
    char_end    INTEGER       NOT NULL CHECK (char_end >= char_start),
    x0          NUMERIC(9, 3) NOT NULL,
    y0          NUMERIC(9, 3) NOT NULL,
    x1          NUMERIC(9, 3) NOT NULL,
    y1          NUMERIC(9, 3) NOT NULL,
    confidence  NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

    PRIMARY KEY (reading_id, seq),
    CONSTRAINT page_reading_item_box_ordered CHECK (x1 >= x0 AND y1 >= y0)
);

GRANT SELECT, INSERT, DELETE ON page_reading, page_reading_item TO lokdarpan_etl;
GRANT USAGE ON SEQUENCE page_reading_id_seq TO lokdarpan_etl;
