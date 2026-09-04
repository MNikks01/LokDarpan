-- 0016 · Where on the page a value was read from.
--
-- WHY THIS EXISTS
-- A fact's evidence has been `raw_text`: 160 characters either side of the
-- figure. That answers "what does the sentence say" and not "where on the page
-- is it", so a reader who doubts a figure can be shown the words we read but
-- not the region they came from. The traceability chain this project promises —
-- document → page → bounding box → source text → value — stops one link short.
--
-- The geometry was always there. pdf.js returns a transform and a size for
-- every text item and the pipeline discarded them, so this needs no new
-- dependency and no re-fetch: the original bytes are in the content-addressed
-- raw store and re-reading them is free.
--
-- COORDINATES ARE STORED AS THE PDF STATES THEM
-- Origin bottom-left, y increasing upward, in points, unscaled. Converting to a
-- screen convention here would bake one renderer's assumption into the ledger,
-- and a wrong flip is invisible until someone highlights the wrong line. The
-- page box is stored beside the items so any consumer can convert with the
-- numbers in front of it.

ALTER TABLE document_page
    -- The page box from pdf.js's viewport, in points.
    ADD COLUMN width  NUMERIC(9, 3),
    ADD COLUMN height NUMERIC(9, 3),

    ADD CONSTRAINT document_page_dimensions_positive
        CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0));

-- One row per text item pdf.js reports, in the order it reports them.
--
-- `char_start`/`char_end` index into `document_page.content`, which is rebuilt
-- from these items exactly — `str + (hasEOL ? "\n" : "")`, verified
-- byte-identical against what the extractor already stored. That is what lets a
-- figure found by character offset be mapped back to a region without changing
-- a single stored evidence string.
CREATE TABLE document_text_item (
    id           BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id  BIGINT       NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    page_number  INTEGER      NOT NULL CHECK (page_number >= 1),

    -- Position in pdf.js's own ordering, so a reading can be reproduced.
    seq          INTEGER      NOT NULL CHECK (seq >= 0),

    -- Half-open range into document_page.content.
    char_start   INTEGER      NOT NULL CHECK (char_start >= 0),
    char_end     INTEGER      NOT NULL CHECK (char_end >= char_start),

    x0           NUMERIC(9, 3) NOT NULL,
    y0           NUMERIC(9, 3) NOT NULL,
    x1           NUMERIC(9, 3) NOT NULL,
    y1           NUMERIC(9, 3) NOT NULL,

    CONSTRAINT document_text_item_box_ordered CHECK (x1 >= x0 AND y1 >= y0),
    CONSTRAINT document_text_item_unique UNIQUE (document_id, page_number, seq)
);

CREATE INDEX document_text_item_span_idx
    ON document_text_item (document_id, page_number, char_start, char_end);

-- The region of the figure itself, not of the evidence window around it.
--
-- Nullable because it is not always establishable: a fact extracted before this
-- migration has none until re-extraction, and a value a person supplied through
-- the corrections file is theirs rather than a region of the page.
ALTER TABLE document_fact
    ADD COLUMN bbox_x0 NUMERIC(9, 3),
    ADD COLUMN bbox_y0 NUMERIC(9, 3),
    ADD COLUMN bbox_x1 NUMERIC(9, 3),
    ADD COLUMN bbox_y1 NUMERIC(9, 3),

    -- All four or none. A partial box is not a location.
    ADD CONSTRAINT document_fact_bbox_complete CHECK (
        num_nonnulls(bbox_x0, bbox_y0, bbox_x1, bbox_y1) IN (0, 4)
    ),
    ADD CONSTRAINT document_fact_bbox_ordered CHECK (
        bbox_x0 IS NULL OR (bbox_x1 >= bbox_x0 AND bbox_y1 >= bbox_y0)
    );

COMMENT ON TABLE document_text_item IS
    'Every text item pdf.js reported for a page, with its character range in document_page.content and its box in PDF coordinates (origin bottom-left, points). Lets a figure located by character offset be traced to a region of the page.';
