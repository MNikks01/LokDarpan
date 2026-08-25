-- 0001 · The one hierarchy, the raw-artifact store, and dataset versioning.
--
-- admin_unit is the ONLY hierarchy. .docs/05-data-model/database-design.md
-- retains a legacy `district` table; it is deliberately not recreated here.
-- Two code paths for "a place" is the fastest route to an unmaintainable app.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Raw artefacts: content-addressed, immutable, never mutated.
-- Every fact in the ledger points back to the bytes it came from.
-- ---------------------------------------------------------------------------
CREATE TABLE source_artifact (
    sha256          CHAR(64)    PRIMARY KEY,
    source_id       TEXT        NOT NULL,
    source_url      TEXT        NOT NULL,
    retrieved_at    TIMESTAMPTZ NOT NULL,
    http_status     INTEGER,
    content_type    TEXT,
    byte_size       BIGINT      NOT NULL CHECK (byte_size >= 0),
    storage_path    TEXT        NOT NULL,
    CONSTRAINT source_artifact_sha256_lowercase CHECK (sha256 = lower(sha256))
);

COMMENT ON TABLE source_artifact IS
    'Immutable content-addressed store of retrieved bytes. Rows are never updated or deleted.';

-- ---------------------------------------------------------------------------
-- Dataset versions: monotonic. The web tier revalidates ISR by this value,
-- not by time (.docs/02-architecture/web-architecture.md).
-- ---------------------------------------------------------------------------
CREATE TABLE dataset_version (
    id              BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    description     TEXT        NOT NULL,
    sealed_at       TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- The hierarchy.
-- ---------------------------------------------------------------------------
CREATE TYPE admin_unit_level AS ENUM (
    'country',
    'state',
    'district',
    'sub_district',
    'block',
    'village',
    'urban_local_body',
    'ward',
    'gram_panchayat'
);

CREATE TABLE admin_unit (
    id                  BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lgd_code            TEXT             NOT NULL,
    level               admin_unit_level NOT NULL,
    name_en             TEXT             NOT NULL,
    -- LGD publishes a local-script name for many units (e.g. छत्तीसगढ़).
    -- Nullable because it is genuinely absent for some, and missing is never
    -- an empty string.
    name_local          TEXT,
    parent_id           BIGINT           REFERENCES admin_unit (id),

    -- Provenance. Not optional, and not a code-review item: a unit that
    -- cannot name the artefact it came from must not exist.
    source_sha256       CHAR(64)         NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id  BIGINT           NOT NULL REFERENCES dataset_version (id),
    extraction_confidence NUMERIC(4,3)   NOT NULL
        CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),

    valid_from          DATE             NOT NULL,
    valid_to            DATE,

    CONSTRAINT admin_unit_lgd_code_level_unique UNIQUE (lgd_code, level),
    CONSTRAINT admin_unit_not_own_parent        CHECK (parent_id IS DISTINCT FROM id),
    CONSTRAINT admin_unit_valid_range           CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT admin_unit_name_en_not_blank     CHECK (length(btrim(name_en)) > 0),
    CONSTRAINT admin_unit_name_local_not_blank  CHECK (name_local IS NULL OR length(btrim(name_local)) > 0)
);

COMMENT ON COLUMN admin_unit.name_local IS
    'Local-script name as published. NULL means not published — never an empty string.';

CREATE INDEX admin_unit_parent_idx  ON admin_unit (parent_id);
CREATE INDEX admin_unit_level_idx   ON admin_unit (level);
CREATE INDEX admin_unit_lgd_idx     ON admin_unit (lgd_code);

-- ---------------------------------------------------------------------------
-- Closure table: ancestor -> descendant at every depth, so "everything under
-- this unit" is one indexed read at any of the nine levels.
-- ---------------------------------------------------------------------------
CREATE TABLE admin_unit_closure (
    ancestor_id     BIGINT  NOT NULL REFERENCES admin_unit (id) ON DELETE CASCADE,
    descendant_id   BIGINT  NOT NULL REFERENCES admin_unit (id) ON DELETE CASCADE,
    depth           INTEGER NOT NULL CHECK (depth >= 0),
    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX admin_unit_closure_descendant_idx ON admin_unit_closure (descendant_id, depth);
