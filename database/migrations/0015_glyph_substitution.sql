-- 0015 · How much of a page's text layer is not the text.
--
-- WHY THIS EXISTS
-- `document.pages_without_text` counts pages with no text layer, which is the
-- coverage question we knew to ask. It cannot see the case that actually cost
-- us: a page whose text layer is present and *wrong*.
--
-- Four of the ten CAG reports held map glyphs through a non-Unicode font. Their
-- text extracts as mojibake — Latin letters and symbols wedged into Devanagari
-- words, "मेसस! इंडो अलाइड <ोटन फूस" for "मेसर्स इंडो अलाइड प्रोटीन फूड्स". The page
-- renders correctly to a human; only the extracted text is garbage.
--
-- That is not merely lost coverage. Digits survive mojibake and unit words do
-- not, which is precisely the input that turns ₹2.12 crore into ₹1. Two scale
-- errors of seven orders of magnitude came from it before it was measured, and
-- 824 candidates were withheld because their evidence could not be read.
--
-- WHY A RATIO AND NOT A FLAG
-- A boolean fixes the threshold at write time and cannot be revisited without
-- re-extracting every document. The ratio is the measurement; what counts as
-- unusable is a reading of it, and that reading will change as more font
-- mappings are met.

ALTER TABLE document_page
    -- Substituted glyphs as a share of the page's Devanagari characters:
    -- a Latin letter or ASCII symbol directly adjacent to a Devanagari one.
    -- Clean Marathi pages measure 0; the mojibake pages here measure well above
    -- 0.02, and no page observed so far falls between.
    --
    -- NULL where the question does not arise — a page with no text, or one with
    -- too little Devanagari for the ratio to mean anything.
    ADD COLUMN glyph_substitution NUMERIC(5, 4),

    ADD CONSTRAINT document_page_glyph_substitution_range
        CHECK (glyph_substitution IS NULL
               OR (glyph_substitution >= 0 AND glyph_substitution <= 1));

COMMENT ON COLUMN document_page.glyph_substitution IS
    'Share of this page''s Devanagari characters adjacent to a substituted glyph, or NULL where the page has no text or too little Devanagari to judge. A high value means the text layer is present and unusable, which pages_without_text cannot express.';
