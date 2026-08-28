-- 0010 · Geometry for the hierarchy, and the provenance of every boundary.
--
-- WHY A SEPARATE TABLE RATHER THAN A COLUMN ON admin_unit
-- Most units have no boundary we may publish. LGD names them; nobody publishes
-- their polygons in a form we can use. A nullable geometry column would make
-- that the normal case and leave the absence unexplained, whereas an absent row
-- here is an explicit statement: this unit exists, and we hold no boundary for
-- it. The UI renders that absence rather than an empty map
-- (.docs/17-legal/legal-ethical-rules.md — missing is never zero).
--
-- WHY PROVENANCE SITS ON THE GEOMETRY, NOT BESIDE IT
-- An accountability platform must be able to say where a line on a map came
-- from. A boundary traced from OpenStreetMap and a boundary published by a
-- state government are different kinds of claim, and presenting them
-- identically would overstate the second or understate the first.

CREATE TYPE boundary_source_kind AS ENUM (
    -- Published by the government body that defines the boundary.
    'official_government',
    -- An openly licensed dataset — OpenStreetMap and the like. Usable and
    -- attributable, but not an authoritative statement of the boundary.
    'open_dataset',
    -- Computed by us from other geometry (a union of children, say). Never a
    -- source in its own right; the derivation must be reproducible.
    'derived'
);

COMMENT ON TYPE boundary_source_kind IS
    'What kind of claim a boundary is. There is no "approximate" member on purpose: a boundary we cannot source is absent, not guessed.';

CREATE TABLE admin_unit_boundary (
    admin_unit_id       BIGINT               PRIMARY KEY REFERENCES admin_unit (id) ON DELETE CASCADE,

    -- WGS84. Every source we ingest publishes in it, and the web client
    -- consumes it directly; reprojection would be a step that can silently
    -- shift a boundary.
    geometry            geometry(MultiPolygon, 4326) NOT NULL,

    source_kind         boundary_source_kind NOT NULL,
    source_name         TEXT                 NOT NULL,
    source_licence      TEXT                 NOT NULL,
    source_url          TEXT,
    -- The identifier this boundary carries in its source, so a reader can find
    -- the same object there: an OSM relation id, a survey sheet number.
    source_ref          TEXT,
    -- The government body that defines the boundary. Required when the claim is
    -- that a government published it, and meaningless otherwise.
    authority           TEXT,

    retrieved_at        TIMESTAMPTZ          NOT NULL,
    dataset_version_id  BIGINT               NOT NULL REFERENCES dataset_version (id),

    -- A self-intersecting polygon renders as nonsense and breaks every spatial
    -- predicate downstream. Rejecting it at write time keeps the failure at the
    -- ingestion boundary, where it can be reported against its source.
    CONSTRAINT admin_unit_boundary_geometry_valid CHECK (ST_IsValid(geometry)),
    CONSTRAINT admin_unit_boundary_not_empty      CHECK (NOT ST_IsEmpty(geometry)),
    CONSTRAINT admin_unit_boundary_source_named   CHECK (length(btrim(source_name)) > 0),
    CONSTRAINT admin_unit_boundary_licence_named  CHECK (length(btrim(source_licence)) > 0),
    CONSTRAINT admin_unit_boundary_authority_when_official CHECK (
        source_kind <> 'official_government' OR (authority IS NOT NULL AND length(btrim(authority)) > 0)
    )
);

COMMENT ON TABLE admin_unit_boundary IS
    'One boundary per unit, with the source that published it. No row means no boundary is held — which is a fact about our holdings, not about the unit.';

COMMENT ON COLUMN admin_unit_boundary.authority IS
    'The government body defining the boundary. NOT NULL is enforced only for official_government, where an unattributed claim of officialness would be the misleading case.';

-- Viewport and containment queries: "which units intersect this box", "which
-- units contain this point". Both are index scans with this in place and
-- sequential scans without it.
CREATE INDEX admin_unit_boundary_gix ON admin_unit_boundary USING GIST (geometry);
CREATE INDEX admin_unit_boundary_kind_idx ON admin_unit_boundary (source_kind);
