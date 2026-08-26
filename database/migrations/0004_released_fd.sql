-- 0004 · The second release stage.
--
-- BEAMS publishes two distinct releases, not one:
--
--   BUDGET  ->  RELEASED FD  ->  RELEASED Dept  ->  EXPENDITURE
--
-- `RELEASED FD` is the Finance Department releasing to the administrative
-- department; `RELEASED Dept` is that department releasing onward for spending.
-- Money can sit at either stage, and collapsing them would hide where.
--
-- `released_inr` continues to mean the departmental release — the figure the
-- release variance in .docs/07-analytics/analytics-engine.md is defined
-- against, since it is what was actually available to spend.

ALTER TABLE scheme_finance
    ADD COLUMN released_fd_inr NUMERIC(20,2) CHECK (released_fd_inr >= 0);

COMMENT ON COLUMN scheme_finance.released_fd_inr IS
    'Finance Department release to the department. NULL where unpublished, never zero.';
COMMENT ON COLUMN scheme_finance.released_inr IS
    'Departmental release, available to spend. The denominator for release variance.';

-- The view gains the earlier stage without changing what the two required
-- variances mean. Dropped and recreated rather than replaced: CREATE OR REPLACE
-- cannot insert a column into the middle of a view'''s column list.
DROP VIEW IF EXISTS scheme_finance_variance;

CREATE VIEW scheme_finance_variance AS
SELECT
    f.id,
    f.budget_scheme_id,
    f.fiscal_year,
    f.object_code,
    f.allocated_inr,
    f.released_fd_inr,
    f.released_inr,
    f.utilized_inr,

    CASE WHEN f.released_inr IS NULL OR f.utilized_inr IS NULL THEN NULL
         ELSE f.released_inr - f.utilized_inr END      AS release_variance_inr,
    CASE WHEN f.allocated_inr IS NULL OR f.utilized_inr IS NULL THEN NULL
         ELSE f.allocated_inr - f.utilized_inr END     AS allocation_variance_inr,

    CASE WHEN f.allocated_inr IS NULL OR f.released_inr IS NULL OR f.utilized_inr IS NULL
         THEN 'insufficient_data' ELSE 'complete' END  AS status,

    f.extraction_confidence,
    f.linkage_confidence,
    f.source_sha256,
    f.dataset_version_id
FROM scheme_finance f;
