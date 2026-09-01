-- 0012 · Tenders advertised on state e-procurement portals.
--
-- WHAT THIS TABLE IS, AND THE ONE THING IT IS NOT
-- A tender is an ADVERTISEMENT OF INTENT TO BUY. It is not an award, and it
-- says nothing about who was paid or how much. Award-of-contract data is
-- CAPTCHA-gated on every GePNIC deployment tested and on CPPP
-- (.docs/06-government-sources/gepnic-access-findings.md), so we do not hold
-- it. There is deliberately no winner, contractor or awarded-value column:
-- a nullable column would invite a screen to imply we might know.
--
-- WHY THERE IS NO VALUE COLUMN
-- The landing page — the only surface reachable without an interactive check —
-- publishes four fields: title, reference, closing date and bid opening date.
-- No estimated value, no organisation. A value column would be null on every
-- row we can currently collect, which states an absence as a data gap rather
-- than as what it is: a field the source does not publish here.
--
-- WHY COLLECTION IS FORWARD-ONLY, AND WHY THAT NEEDS ITS OWN TABLE
-- The landing page shows a rolling window of roughly twenty current tenders.
-- It cannot be paged backwards. Collection therefore accumulates the tender
-- universe from the day it starts and can never backfill, so
-- tender_collection_window records when we began watching each portal. Without
-- it a reader cannot tell "the government advertised nothing" from "we were
-- not looking yet", and the second silently reads as the first.

CREATE TABLE tender (
    id BIGSERIAL PRIMARY KEY,

    -- Which portal deployment. Parameterised, never a per-state module:
    -- ~28 states run the same platform with the same page structure.
    portal_code TEXT NOT NULL,

    -- IDENTITY, AND WHY IT IS NOT THE REFERENCE NUMBER
    -- The portal's own opaque tender id, taken from the detail link's `sp`
    -- parameter. Verified on Tamil Nadu 2026-08-29: twenty of twenty values
    -- were byte-identical across separate fetches, so it is stable despite the
    -- surrounding URL carrying `session=T`.
    --
    -- The reference number is NOT unique and must never be the key. In that
    -- same fetch, reference `1657/2026/E1` appeared on six distinct tenders and
    -- `E5/6052/2025` on four; keying on it would have silently collapsed twenty
    -- rows into fifteen. Nor is the visible content unique — five rows shared a
    -- title, reference and closing date with another row.
    --
    -- If a portal ever rotates this id, the failure mode is duplicate rows:
    -- over-reporting, which is visible and repairable. Keying on the reference
    -- would under-report, which is neither.
    portal_tender_id TEXT NOT NULL,

    -- The department's own file reference, as printed. Not unique, by
    -- observation; kept because it is how a person cites the tender.
    tender_reference TEXT NOT NULL,
    title TEXT NOT NULL,

    closing_at TIMESTAMPTZ,
    bid_opening_at TIMESTAMPTZ,

    -- Where the tender is, WHEN that can be established. The landing page names
    -- no organisation, so this is resolved from the title and reference text or
    -- not at all. An unplaceable tender stays unplaced: missing is never zero.
    admin_unit_id BIGINT REFERENCES admin_unit (id),
    linkage_confidence NUMERIC(4, 3),

    -- THE OBSERVATION WINDOW, distinct from anything the government published.
    -- When WE saw a row is a fact about us, not about the tender, and conflating
    -- the two would let our collection history masquerade as publication
    -- history.
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,

    source_sha256 TEXT NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_version (id),
    extraction_confidence NUMERIC(4, 3) NOT NULL,

    CONSTRAINT tender_identity UNIQUE (portal_code, portal_tender_id),
    CONSTRAINT tender_extraction_confidence_range CHECK (
        extraction_confidence >= 0 AND extraction_confidence <= 1
    ),
    CONSTRAINT tender_linkage_confidence_range CHECK (
        linkage_confidence IS NULL
        OR (linkage_confidence >= 0 AND linkage_confidence <= 1)
    ),
    -- A unit is either placed with a stated confidence or not placed at all.
    -- A placement without one is an unattributed claim about where public money
    -- is being spent.
    CONSTRAINT tender_linkage_attributed CHECK (
        admin_unit_id IS NULL OR linkage_confidence IS NOT NULL
    ),
    CONSTRAINT tender_seen_ordered CHECK (last_seen_at >= first_seen_at)
);

COMMENT ON TABLE tender IS
'Tenders advertised on state e-procurement portals. Advertisements of intent to buy, never awards: no winner or awarded value is held, because that data is CAPTCHA-gated platform-wide.';

COMMENT ON COLUMN tender.portal_tender_id IS
'The portal''s opaque tender id (the detail link''s sp parameter). The identity, because reference numbers are shared across distinct tenders.';

COMMENT ON COLUMN tender.first_seen_at IS
'When LokDarpan first observed this row. Not a publication date — collection is forward-only and cannot backfill.';

CREATE INDEX tender_portal_idx ON tender (portal_code, last_seen_at DESC);
CREATE INDEX tender_unit_idx ON tender (admin_unit_id) WHERE admin_unit_id IS NOT NULL;

-- When we started watching each portal, so a gap can be told from a silence.
CREATE TABLE tender_collection_window (
    portal_code TEXT PRIMARY KEY,
    -- The honest floor on the data. Every list rendered from this table must
    -- say "nothing is held before this date", the way a missing figure names
    -- its expected source.
    collecting_since DATE NOT NULL,
    last_success_at TIMESTAMPTZ,
    note TEXT
);

COMMENT ON TABLE tender_collection_window IS
'When collection began for each portal. The floor below which absence means "we were not looking", never "nothing was advertised".';
