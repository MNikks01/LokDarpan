-- 0025 · What we know about how complete our geography is.
--
-- THE MISTAKE THIS PREVENTS
-- Pune district holds 14 talukas and no urban local body, so the explorer
-- offered 14 areas and nothing else. Pune Municipal Corporation plainly exists.
-- The interface was reporting our holdings and a reader can only read it as a
-- statement about Pune.
--
-- Counting is not the missing piece — the count is already a query. What
-- cannot be derived from the ledger is whether anyone looked, and whether what
-- came back is known to be short. `admin_unit` holds the places we have; no
-- table held the fact that a level was only partly collected, so absence and
-- incompleteness were the same shape.
--
-- SCOPE: A STATE AND A LEVEL
-- Coverage is a property of a source's treatment of a level across a state, not
-- of one district. OpenStreetMap tags few of Maharashtra's municipal bodies
-- everywhere in the state, not specially in Pune. Recording it per district
-- would be 36 copies of one fact and would invite a reader to think Pune was
-- assessed separately.

CREATE TYPE coverage_status AS ENUM (
    -- Every unit the source publishes at this level is held.
    'complete',
    -- Some are held and the source is known to publish more. The note says how
    -- that is known.
    'partial',
    -- Nothing has been collected at this level. Says nothing about how many
    -- exist.
    'not_collected'
);

CREATE TABLE geography_coverage (
    -- The state, or any unit a collection was scoped to.
    admin_unit_id BIGINT NOT NULL REFERENCES admin_unit (id) ON DELETE CASCADE,
    level admin_unit_level NOT NULL,

    status coverage_status NOT NULL,

    -- Where the units came from, so "partial" is attributable to a source
    -- rather than floating free.
    source_id TEXT NOT NULL,

    -- Why this status. Required for `partial`, because "some are missing" is
    -- not a finding until it says how that is known.
    note TEXT,

    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ingestion_run_id BIGINT REFERENCES ingestion_run (id),

    PRIMARY KEY (admin_unit_id, level),

    CONSTRAINT geography_coverage_partial_is_explained CHECK (
        status <> 'partial' OR (note IS NOT NULL AND note <> '')
    )
);

COMMENT ON TABLE geography_coverage IS
'How complete our holdings are for one level within one unit. Absence of records is not absence of places, and this is where the difference is written down.';

-- ---------------------------------------------------------------------------
-- Maharashtra, from the coverage finding recorded on 2026-09-05 in
-- .docs/06-government-sources/gis/maharashtra-local-body-coverage.md.
--
-- Conditional, so a clean database gets nothing: with no Maharashtra row there
-- is no geography to make a claim about, and asserting coverage over units that
-- do not exist would be the same error in the other direction.
-- ---------------------------------------------------------------------------
INSERT INTO geography_coverage (admin_unit_id, level, status, source_id, note)
SELECT u.id, 'district', 'complete', 'openstreetmap-overpass',
       'All 36 districts are held, each carrying an LGD code.'
  FROM admin_unit u
 WHERE u.level = 'state' AND u.lgd_code = '27'
ON CONFLICT DO NOTHING;

INSERT INTO geography_coverage (admin_unit_id, level, status, source_id, note)
SELECT u.id, 'sub_district', 'complete', 'openstreetmap-overpass',
       '355 talukas are held; 353 carry an LGD code, so they are the units the Local Government Directory names.'
  FROM admin_unit u
 WHERE u.level = 'state' AND u.lgd_code = '27'
ON CONFLICT DO NOTHING;

INSERT INTO geography_coverage (admin_unit_id, level, status, source_id, note)
SELECT u.id, 'urban_local_body', 'partial', 'openstreetmap-overpass',
       'OpenStreetMap tags 18 of Maharashtra''s urban local bodies at this level, of an estimated 270, and none carries an LGD code. The Local Government Directory names them all and publishes no boundaries; its bulk download is CAPTCHA-gated. A district with no local body listed means none is held.'
  FROM admin_unit u
 WHERE u.level = 'state' AND u.lgd_code = '27'
ON CONFLICT DO NOTHING;
