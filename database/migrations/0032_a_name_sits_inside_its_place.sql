-- 0032 · A place's name sits inside the place.
--
-- The map placed each area's name at the middle of its bounding box. For a
-- coastal district, a crescent-shaped taluka or a unit in several pieces, that
-- point can be in the sea or in a neighbouring unit, so the name reads as a
-- claim about somewhere else. The same code ranked names by bounding-box area in
-- square degrees, which inflates units spread across islands and shrinks
-- northern ones.
--
-- Both are properties of the geometry, so they are computed from it, in the
-- database, once:
--
--   label_point  the centre of the largest circle that fits inside the shape,
--                which lies inside the shape and away from its edges
--   area_m2      the area on the ellipsoid, in square metres
--
-- Generated columns rather than loader code. Every path that writes a boundary
-- (the OSM loader today, any official source later) gets them, and a boundary
-- whose geometry changes cannot keep a stale label point.
--
-- Requires PostGIS 3.1 or later (ST_MaximumInscribedCircle). CI runs 3.4.
-- .docs/adr/057-place-names-are-placed-in-the-browser.md

ALTER TABLE admin_unit_boundary
    ADD COLUMN label_point geometry(Point, 4326)
        GENERATED ALWAYS AS ((ST_MaximumInscribedCircle(geometry)).center) STORED,
    ADD COLUMN area_m2 double precision
        GENERATED ALWAYS AS (ST_Area(geometry::geography)) STORED;

COMMENT ON COLUMN admin_unit_boundary.label_point IS
    'Where the unit''s name is drawn: the centre of the largest inscribed circle, so it lies inside the unit. Derived from geometry; never written directly.';
COMMENT ON COLUMN admin_unit_boundary.area_m2 IS
    'Area on the WGS84 ellipsoid in square metres. Used only to decide which of two overlapping names is drawn, never as a statistic.';
