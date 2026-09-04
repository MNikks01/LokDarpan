-- 0014 · One reported figure, cited twice, counted once.
--
-- WHY THIS EXISTS
-- The CAG reports are published as a single PDF containing the whole report in
-- Marathi and then the whole report in English. Extraction reads both halves,
-- so a figure the state reported once becomes two facts with two citations —
-- 489 of 506 distinct values in the corpus appear in both halves. Both rows are
-- individually true: each page really does state that amount. But an aggregate
-- summing facts would count the same rupee twice, and `bigint` paise protects
-- precision, not double counting.
--
-- WHY BOTH ROWS STAY
-- Retiring the Marathi half would be simpler and is wrong. A Marathi reader
-- following a citation must land on the Marathi page, and provenance that
-- silently redirects to a translation is not provenance. So both facts remain,
-- and one is marked as another citation of the other.
--
-- WHY A POINTER AND NOT A GROUP TABLE
-- The relationship is a pair, not a set: two halves of one document, never
-- three. A nullable self-reference says exactly that and lets an aggregate
-- express the rule as `WHERE same_figure_as IS NULL` rather than a join.

ALTER TABLE document_fact
    -- The fact this one is a second citation of. NULL means "this fact is the
    -- one to count" — which is every fact until something links it, so the
    -- column is safe to ignore and impossible to get wrong by omission.
    --
    -- The target is the English-half fact wherever the pair spans languages.
    -- Not a claim that English is authoritative: the Marathi text layer in this
    -- corpus mangles Devanagari conjuncts, so the English row is the one whose
    -- stored evidence a reader can actually read back.
    ADD COLUMN same_figure_as BIGINT REFERENCES document_fact (id) ON DELETE SET NULL,

    -- A fact cannot be a second citation of itself. Chains are prevented by the
    -- linker rather than the schema — Postgres cannot express "the target must
    -- itself be unlinked" as a CHECK — and asserted in the integration tests.
    ADD CONSTRAINT document_fact_same_figure_not_self CHECK (same_figure_as <> id);

-- Aggregates filter on this column, and the review queue does not, so the index
-- covers the lookup that will actually be hot.
CREATE INDEX document_fact_same_figure_idx ON document_fact (same_figure_as)
    WHERE same_figure_as IS NOT NULL;

COMMENT ON COLUMN document_fact.same_figure_as IS
    'Another citation of the fact named here. NULL means count this one. Set only for pairs matched unambiguously across the two language halves of one document; an ambiguous match is left NULL rather than guessed.';
