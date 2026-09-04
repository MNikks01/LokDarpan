-- Page geometry is recorded in the PDF's own coordinate space, and a rotated
-- page has two boxes: the one the file states and the one a reader sees.
--
-- 0016 stored the *upright* box from `getViewport({ scale: 1 })`, which applies
-- the page's /Rotate, while text-item transforms are in the unrotated space the
-- file states. On a landscape page the two disagree by a quarter turn, which put
-- 46 boxes past the right edge of their own page — a highlight that would land
-- outside the page it belongs to.
--
-- `width`/`height` now describe the same space the coordinates are in, and the
-- rotation is recorded beside them so a renderer can turn the page without
-- having to re-open the file to discover that it should.

ALTER TABLE document_page
    ADD COLUMN rotation SMALLINT;

-- The four quarter turns a PDF may declare. NULL until a page is re-read.
ALTER TABLE document_page
    ADD CONSTRAINT document_page_rotation_is_a_quarter_turn
        CHECK (rotation IS NULL OR rotation IN (0, 90, 180, 270));

COMMENT ON COLUMN document_page.rotation IS
    'The page''s declared /Rotate in degrees. width and height are the unrotated box, matching the coordinate space of document_text_item and document_fact.bbox_*.';
