-- 0033 · A level's outlines are simplified once, when they are written.
--
-- The level endpoint simplified every child boundary on every request:
-- ST_SimplifyPreserveTopology over Madhya Pradesh's 55 districts took ~410 ms
-- of a ~580 ms response, against a 300 ms budget (ADR-062). The result depends
-- only on the geometry, so it is computed from the geometry, in the database,
-- once — the same reasoning, and the same mechanism, as label_point in 0032.
--
--   geometry_overview  the boundary simplified at 0.005 degrees (~550 m), the
--                      tolerance the map draws a whole level at
--
-- A generated column, so every loader gets it and a changed geometry cannot keep
-- a stale outline. The tolerance lives here and nowhere else;
-- geography.repository.ts reads the column rather than repeating the number.
-- .docs/adr/065-a-level-is-drawn-from-outlines-made-when-they-were-loaded.md

ALTER TABLE admin_unit_boundary
    ADD COLUMN geometry_overview geometry(Geometry, 4326)
        GENERATED ALWAYS AS (ST_SimplifyPreserveTopology(geometry, 0.005)) STORED;

COMMENT ON COLUMN admin_unit_boundary.geometry_overview IS
    'The boundary simplified at 0.005 degrees, the tolerance a whole level is drawn at. Derived from geometry; never written directly.';
