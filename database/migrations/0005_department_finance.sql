-- 0005 · Departmental actuals, at the grain BEAMS publishes them.
--
-- A different report from the one behind `scheme_finance`, at a coarser grain
-- (department × year, not scheme × object × year) and carrying figures the
-- scheme-wise export does not have for earlier years
-- (.docs/06-government-sources/beams-discovery.md §Correction).
--
-- Kept as its own table rather than merged into `scheme_finance`: the two are
-- separate assertions by the same government, they disagree for some years,
-- and flattening them would destroy the ability to say so.

CREATE TABLE department_finance (
    id                    BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id         BIGINT        NOT NULL REFERENCES department (id),
    fiscal_year           SMALLINT      NOT NULL CHECK (fiscal_year BETWEEN 1947 AND 2200),
    -- The report is cut by month range; April–March is the full year.
    from_month            SMALLINT      NOT NULL CHECK (from_month BETWEEN 1 AND 12),
    to_month              SMALLINT      NOT NULL CHECK (to_month BETWEEN 1 AND 12),

    -- Every amount nullable: NULL is "not published", never zero.
    budgeted_inr          NUMERIC(20,2) CHECK (budgeted_inr >= 0),
    released_inr          NUMERIC(20,2) CHECK (released_inr >= 0),
    received_inr          NUMERIC(20,2) CHECK (received_inr >= 0),
    -- Two measures of spending, deliberately not collapsed: what BEAMS recorded
    -- and what the treasury actually paid out. They are different numbers and
    -- the difference is itself informative.
    beams_expenditure_inr    NUMERIC(20,2) CHECK (beams_expenditure_inr >= 0),
    treasury_expenditure_inr NUMERIC(20,2) CHECK (treasury_expenditure_inr >= 0),

    extraction_confidence NUMERIC(4,3)  NOT NULL
        CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
    linkage_confidence    NUMERIC(4,3)  NOT NULL
        CHECK (linkage_confidence >= 0 AND linkage_confidence <= 1),
    source_sha256         CHAR(64)      NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id    BIGINT        NOT NULL REFERENCES dataset_version (id),

    CONSTRAINT department_finance_unique UNIQUE (department_id, fiscal_year, from_month, to_month)
);

-- As with scheme_finance, no constraint that spending cannot exceed release.
-- The published data breaks that, and refusing a true record is worse than
-- recording an inconsistency.

CREATE INDEX department_finance_dept_year_idx ON department_finance (department_id, fiscal_year);

COMMENT ON COLUMN department_finance.beams_expenditure_inr IS
    'Expenditure as recorded in BEAMS.';
COMMENT ON COLUMN department_finance.treasury_expenditure_inr IS
    'Expenditure actually effected in the treasury. Not the same measure as BEAMS expenditure.';
