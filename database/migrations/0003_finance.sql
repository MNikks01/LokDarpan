-- 0003 · Departmental budget, release and expenditure.
--
-- Grain follows the source: one row per (department, demand, scheme, object,
-- financial year), which is what BEAMS publishes
-- (.docs/06-government-sources/beams-discovery.md).
--
-- Amounts are NUMERIC(20,2) in rupees, paise precision, never float
-- (.docs/05-data-model/database-design.md). A national multi-year aggregate
-- exceeds Number.MAX_SAFE_INTEGER, so amounts cross the wire as decimal
-- strings and are handled in application code as bigint paise.

-- ---------------------------------------------------------------------------
-- Departments. BEAMS identifies them by a single-letter code and does not
-- publish the name in its export, so name_en is nullable and genuinely empty
-- for now — a name must not be invented from an inference.
-- ---------------------------------------------------------------------------
CREATE TABLE department (
    id                    BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_unit_id         BIGINT       NOT NULL REFERENCES admin_unit (id),
    code                  TEXT         NOT NULL,
    name_en               TEXT,
    name_local            TEXT,

    source_sha256         CHAR(64)     NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id    BIGINT       NOT NULL REFERENCES dataset_version (id),
    extraction_confidence NUMERIC(4,3) NOT NULL
        CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),

    CONSTRAINT department_code_unique_per_unit UNIQUE (admin_unit_id, code),
    CONSTRAINT department_code_not_blank       CHECK (length(btrim(code)) > 0),
    CONSTRAINT department_name_en_not_blank    CHECK (name_en IS NULL OR length(btrim(name_en)) > 0),
    CONSTRAINT department_name_local_not_blank CHECK (name_local IS NULL OR length(btrim(name_local)) > 0)
);

COMMENT ON COLUMN department.name_en IS
    'NULL where the source publishes no name. Never inferred from the code.';

-- ---------------------------------------------------------------------------
-- Schemes — the chart-of-accounts coordinates a fact hangs from.
-- ---------------------------------------------------------------------------
CREATE TABLE budget_scheme (
    id                    BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id         BIGINT       NOT NULL REFERENCES department (id),
    demand_no             TEXT         NOT NULL,
    scheme_code           TEXT         NOT NULL,
    name_en               TEXT,
    name_local            TEXT,
    -- Reproduced as published rather than normalised into booleans: 'Voted'
    -- and 'Charged' are terms of art in an appropriation act, and collapsing
    -- them would lose the distinction the act draws.
    charged_voted         TEXT,
    scheme_committed      TEXT,
    source_of_fund        TEXT,
    plan_type             TEXT,

    source_sha256         CHAR(64)     NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id    BIGINT       NOT NULL REFERENCES dataset_version (id),
    extraction_confidence NUMERIC(4,3) NOT NULL
        CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),

    CONSTRAINT budget_scheme_unique UNIQUE (department_id, demand_no, scheme_code),
    CONSTRAINT budget_scheme_demand_not_blank CHECK (length(btrim(demand_no)) > 0),
    CONSTRAINT budget_scheme_code_not_blank   CHECK (length(btrim(scheme_code)) > 0)
);

CREATE INDEX budget_scheme_department_idx ON budget_scheme (department_id);

-- ---------------------------------------------------------------------------
-- The money.
-- ---------------------------------------------------------------------------
CREATE TABLE scheme_finance (
    id                    BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    budget_scheme_id      BIGINT        NOT NULL REFERENCES budget_scheme (id),
    -- 2024 denotes FY 2024-25, as BEAMS labels it.
    fiscal_year           SMALLINT      NOT NULL CHECK (fiscal_year BETWEEN 1947 AND 2200),
    object_code           TEXT          NOT NULL,

    -- Every amount is nullable, and NULL means "not published" — never zero.
    -- A zero is a government asserting nothing was allocated; a NULL is the
    -- absence of an assertion, and conflating them fabricates a figure.
    allocated_inr         NUMERIC(20,2) CHECK (allocated_inr >= 0),
    released_inr          NUMERIC(20,2) CHECK (released_inr >= 0),
    utilized_inr          NUMERIC(20,2) CHECK (utilized_inr >= 0),
    reappropriated_inr    NUMERIC(20,2),

    -- Two confidences, not one. Extraction asks "did we read it right"; linkage
    -- asks "does this belong to this scheme". Low linkage is the more serious.
    extraction_confidence NUMERIC(4,3)  NOT NULL
        CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
    linkage_confidence    NUMERIC(4,3)  NOT NULL
        CHECK (linkage_confidence >= 0 AND linkage_confidence <= 1),

    source_sha256         CHAR(64)      NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id    BIGINT        NOT NULL REFERENCES dataset_version (id),

    CONSTRAINT scheme_finance_unique UNIQUE (budget_scheme_id, fiscal_year, object_code),
    CONSTRAINT scheme_finance_object_not_blank CHECK (length(btrim(object_code)) > 0)
);

-- Deliberately absent: any constraint that utilized <= released, or that
-- released <= allocated. Maharashtra's own published data breaks both — BEAMS
-- scheme B-10 for FY2024-25 reports allocated 5,310,000 against released
-- 7,434,000. A CHECK would reject a true government record. Inconsistencies of
-- that kind are observations to surface, not errors to refuse
-- (.docs/05-data-model/database-design.md §Design notes).

CREATE INDEX scheme_finance_scheme_year_idx ON scheme_finance (budget_scheme_id, fiscal_year);
CREATE INDEX scheme_finance_year_idx        ON scheme_finance (fiscal_year);

-- ---------------------------------------------------------------------------
-- Both variances, each with its denominator, computed once, server-side.
--
-- There is deliberately no column named `variance`. Release variance and
-- allocation variance are different quantities against different denominators,
-- and a single ambiguous name is how they get confused.
-- ---------------------------------------------------------------------------
CREATE VIEW scheme_finance_variance AS
SELECT
    f.id,
    f.budget_scheme_id,
    f.fiscal_year,
    f.object_code,
    f.allocated_inr,
    f.released_inr,
    f.utilized_inr,

    CASE WHEN f.released_inr IS NULL OR f.utilized_inr IS NULL THEN NULL
         ELSE f.released_inr - f.utilized_inr END      AS release_variance_inr,
    CASE WHEN f.allocated_inr IS NULL OR f.utilized_inr IS NULL THEN NULL
         ELSE f.allocated_inr - f.utilized_inr END     AS allocation_variance_inr,

    -- No variance is computed across a missing stage. The status names that,
    -- so a reader is told the chain is incomplete rather than shown a figure
    -- computed from an absence.
    CASE WHEN f.allocated_inr IS NULL OR f.released_inr IS NULL OR f.utilized_inr IS NULL
         THEN 'insufficient_data' ELSE 'complete' END  AS status,

    f.extraction_confidence,
    f.linkage_confidence,
    f.source_sha256,
    f.dataset_version_id
FROM scheme_finance f;

COMMENT ON VIEW scheme_finance_variance IS
    'Both variances with their denominators, plus insufficient_data where a stage is unpublished.';
