-- 0040 · An artefact remembers how it was found.
--
-- WHY
-- Maharashtra tender notices are collected from the agencies that issue them
-- (`.docs/04-data-engineering/maharashtra-tender-ingestion.md`). An agency's
-- listing page says a notice exists and states a few things about it — a
-- reference, a board, a closing date; the notice's own PDF is the evidence.
-- Those are two different claims from two different documents, and the ledger
-- must keep them apart: "discovered from" is not "authoritative".
--
-- `source_artifact` records what bytes were fetched and from where. It cannot
-- record that a listing pointed to them, what that listing said, or that the
-- same PDF was seen again on a later night — there is one row per content hash,
-- written once. So a sighting is its own row.
--
-- WHAT THIS DOES
-- `artifact_sighting` holds one row per time a collector saw an artefact:
--   · `sha256`                  the artefact seen (its bytes are in the raw store);
--   · `source_url`              where those bytes were fetched from;
--   · `discovered_from`         the page that pointed to it (a listing), if any;
--   · `discovered_from_sha256`  that page's own artefact, so the listing is evidence too;
--   · `listing_facts`           what the listing row said, as printed — Tier-2 facts,
--                               kept as found until a parser reads the PDF itself;
--   · `http_etag`, `http_last_modified`  the host's validators, for conditional requests.
--
-- Rows are appended, never updated: a second sighting is a second row.

CREATE TABLE artifact_sighting (
    id                     BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sha256                 CHAR(64)    NOT NULL REFERENCES source_artifact (sha256),
    source_id              TEXT        NOT NULL,
    source_url             TEXT        NOT NULL,
    discovered_from        TEXT,
    discovered_from_sha256 CHAR(64)    REFERENCES source_artifact (sha256),
    listing_facts          JSONB,
    seen_at                TIMESTAMPTZ NOT NULL,
    http_status            INTEGER     NOT NULL,
    http_etag              TEXT,
    http_last_modified     TEXT,
    CONSTRAINT artifact_sighting_listing_cited CHECK (
        listing_facts IS NULL OR discovered_from_sha256 IS NOT NULL
    ),
    CONSTRAINT artifact_sighting_facts_are_an_object CHECK (
        listing_facts IS NULL OR jsonb_typeof(listing_facts) = 'object'
    )
);

COMMENT ON TABLE artifact_sighting IS
    'Each time a collector saw an artefact, and what pointed it there. Discovery is kept apart from evidence: the listing that led to a document is recorded and cited, but the document is the authority.';
COMMENT ON COLUMN artifact_sighting.listing_facts IS
    'What the listing row said about the artefact, as printed on the listing. Tier-2 facts: the issuer''s summary, to be checked against the document itself. Requires discovered_from_sha256, so every listing fact cites the listing page it was read from.';

CREATE INDEX artifact_sighting_artifact_idx ON artifact_sighting (sha256, seen_at DESC);
CREATE INDEX artifact_sighting_url_idx ON artifact_sighting (source_url, seen_at DESC);

-- The collector writes sightings; nothing else reads them yet.
GRANT SELECT, INSERT ON artifact_sighting TO lokdarpan_etl;
GRANT USAGE ON SEQUENCE artifact_sighting_id_seq TO lokdarpan_etl;
