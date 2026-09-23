-- Tamil Nadu publishes its CAG reports as separate Tamil and English PDFs, and
-- 730 pages of Tamil were stored with script = 'latin'.
--
-- That is not a cosmetic mislabel. `page_script` exists so that a reader, or a
-- later extraction pass, cannot mistake "this half is in another script" for
-- "this document is empty" — the mistake that was made once already on the
-- Marathi half of the Maharashtra reports. A page of Tamil labelled 'latin'
-- reinstates exactly that trap, one script further along: a query for English
-- pages returns Tamil ones, and every term it searches for is absent from them.
--
-- 'latin' was reached rather than chosen. `scriptOf` tested for Devanagari and
-- for Latin, and Tamil pages carry enough Latin — page numbers, roman numerals,
-- the occasional English acronym — to answer the second question yes.
--
-- The value is only added here. Nothing may be relabelled in this transaction,
-- because PostgreSQL will not let a new enum value be used in the transaction
-- that adds it; the pages are re-read from the raw store by `reprocess:cag`,
-- which recomputes the label from the same bytes that were retrieved.

ALTER TYPE page_script ADD VALUE 'tamil';
