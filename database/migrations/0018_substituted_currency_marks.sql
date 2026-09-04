-- A third kind of broken text layer, and the one the existing measure cannot see.
--
-- `glyph_substitution` (0015) counts Latin letters wedged into Devanagari words.
-- It finds mojibake in Marathi prose and it is blind to this: a layer that emits
-- a backtick where the document prints ₹, and `कोट(` where it prints कोटी. A
-- backtick before a digit is neither Latin-in-Devanagari nor Devanagari-in-Latin,
-- so all 115 affected pages score clean.
--
-- Nothing wrong was published — the parser refuses an amount whose currency mark
-- it cannot read — but those pages were recorded as read and empty, which is a
-- different claim from unreadable, and 494 amounts sit behind them.
--
-- Counted rather than flagged, for the same reason 0015 stores a ratio: the
-- threshold at which a page is worth re-reading can then be revisited without
-- re-extracting the corpus.

ALTER TABLE document_page
    ADD COLUMN substituted_currency_marks INTEGER;

ALTER TABLE document_page
    ADD CONSTRAINT document_page_substituted_marks_not_negative
        CHECK (substituted_currency_marks IS NULL OR substituted_currency_marks >= 0);

COMMENT ON COLUMN document_page.substituted_currency_marks IS
    'How many times a stray mark stands where the page prints a currency symbol. NULL where the page has not been measured; 0 where it was measured and none was found.';
