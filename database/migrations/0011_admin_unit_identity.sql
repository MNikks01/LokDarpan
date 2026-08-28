-- 0011 · A unit may be identified by LGD, by OSM, or by both.
--
-- WHY
-- `lgd_code` was NOT NULL because the Local Government Directory was the only
-- registry we ingested from. It is still the authoritative one, and where it
-- names a unit its code remains the identity we prefer.
--
-- But the directory gates district-and-below views behind a CAPTCHA, so the
-- units inside a district reach us from OpenStreetMap instead. OSM carries
-- `ref:LGD:district` and `ref:LGD:subdistrict` on many Indian boundaries — for
-- Nagpur, on the district and all fourteen talukas — and those join cleanly.
-- It carries no LGD reference on the municipal bodies: "Nagpur City" has none.
--
-- Forcing those into a NOT NULL `lgd_code` would mean inventing a code in the
-- namespace of a government registry. That is a fabricated identifier in the
-- one field a reader would trust most, so the column becomes nullable and the
-- unit is identified by its OSM relation instead. A unit with neither
-- identifier is still rejected: something must be able to name it.

ALTER TABLE admin_unit ALTER COLUMN lgd_code DROP NOT NULL;

ALTER TABLE admin_unit ADD COLUMN osm_relation_id BIGINT;

COMMENT ON COLUMN admin_unit.lgd_code IS
    'Local Government Directory code. NULL when no registry entry has been matched — never a synthesised stand-in.';
COMMENT ON COLUMN admin_unit.osm_relation_id IS
    'OpenStreetMap relation this unit was ingested from, when it reached us that way. Lets a reader open the same object in OSM.';

ALTER TABLE admin_unit ADD CONSTRAINT admin_unit_identified CHECK (
    lgd_code IS NOT NULL OR osm_relation_id IS NOT NULL
);

-- One row per OSM relation. Re-running an ingest must update the unit it
-- already created rather than adding a second copy of the same place.
CREATE UNIQUE INDEX admin_unit_osm_relation_unique
    ON admin_unit (osm_relation_id) WHERE osm_relation_id IS NOT NULL;

-- `admin_unit_lgd_code_level_unique` still stands. Postgres treats NULLs as
-- distinct in a unique constraint, so many OSM-only units coexist under it
-- without collision, while two units claiming one LGD code at one level remain
-- impossible.
