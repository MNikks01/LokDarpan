-- 0022 · What a tender said before it changed.
--
-- WHY THIS EXISTS
-- `tender` is written by an upsert, so a tender whose closing date moved from
-- 18 September to 25 September simply held 25 September afterwards, and the
-- earlier date was gone. A government office extending a deadline, raising an
-- estimate or reissuing a description is exactly the change this project exists
-- to make traceable, and it was the one thing collection destroyed.
--
-- THE SHAPE FOLLOWS 0009, DELIBERATELY
-- `document_fact_review_history` already solved this problem for review
-- decisions: an append-only table, written by a trigger rather than by the
-- application, recording only changes that mean something. The same three
-- properties are wanted here, so the same shape is used rather than a second
-- idea about history.
--
-- `tender` remains the current row. History is read only when a reader asks
-- what changed; the map and the lists never reconstruct anything.

CREATE TABLE tender_version (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tender_id BIGINT NOT NULL REFERENCES tender (id) ON DELETE CASCADE,

    -- The source-controlled fields as they stood before this change. Placement
    -- is absent on purpose: see the trigger.
    tender_reference TEXT NOT NULL,
    title TEXT NOT NULL,
    closing_at TIMESTAMPTZ,
    bid_opening_at TIMESTAMPTZ,
    department TEXT,
    organisation_chain TEXT,
    location TEXT,
    pincode TEXT,
    tender_category TEXT,
    product_category TEXT,
    tender_type TEXT,
    tender_value_paise NUMERIC(20, 2),
    emd_paise NUMERIC(20, 2),

    -- PROVENANCE OF THE SUPERSEDED OBSERVATION, not of the row that replaced
    -- it. A version that could not say which fetch it came from would be a
    -- claim about a government office with no evidence behind it.
    source_sha256 TEXT NOT NULL REFERENCES source_artifact (sha256),
    dataset_version_id BIGINT NOT NULL REFERENCES dataset_version (id),
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,

    superseded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE tender_version IS
'Superseded tender readings. Append-only, written only by the trigger below. The current reading is the tender row itself.';

CREATE INDEX tender_version_tender_idx ON tender_version (tender_id, superseded_at DESC);

-- ---------------------------------------------------------------------------
-- History is written by the database, not by the application.
--
-- The loader upserts every tender it sees on every run. If writing history were
-- the caller's job, the one code path that forgot would lose the change
-- silently, and nothing downstream could tell that from a tender that never
-- changed.
--
-- SECURITY DEFINER and a pinned search_path for the reasons given in 0009.
-- ---------------------------------------------------------------------------
CREATE FUNCTION record_tender_supersession() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
BEGIN
    -- ONLY WHAT THE SOURCE CONTROLS COUNTS AS A CHANGE.
    --
    -- Every run rewrites last_seen_at and dataset_version_id on every tender it
    -- sees. Treating those as changes would file a version per tender per run —
    -- history of our own polling, not of the tender.
    --
    -- Placement is excluded for a different reason. admin_unit_id,
    -- linkage_confidence and district_source are DERIVED by our resolver, not
    -- published by the portal, so a change in them records that we got better
    -- at reading, not that the government said something new. Mixing the two
    -- would make "the tender changed" mean two incompatible things.
    IF  NEW.tender_reference   IS NOT DISTINCT FROM OLD.tender_reference
    AND NEW.title              IS NOT DISTINCT FROM OLD.title
    AND NEW.closing_at         IS NOT DISTINCT FROM OLD.closing_at
    AND NEW.bid_opening_at     IS NOT DISTINCT FROM OLD.bid_opening_at
    AND NEW.department         IS NOT DISTINCT FROM OLD.department
    AND NEW.organisation_chain IS NOT DISTINCT FROM OLD.organisation_chain
    AND NEW.location           IS NOT DISTINCT FROM OLD.location
    AND NEW.pincode            IS NOT DISTINCT FROM OLD.pincode
    AND NEW.tender_category    IS NOT DISTINCT FROM OLD.tender_category
    AND NEW.product_category   IS NOT DISTINCT FROM OLD.product_category
    AND NEW.tender_type        IS NOT DISTINCT FROM OLD.tender_type
    AND NEW.tender_value_paise IS NOT DISTINCT FROM OLD.tender_value_paise
    AND NEW.emd_paise          IS NOT DISTINCT FROM OLD.emd_paise
    THEN
        RETURN NEW;
    END IF;

    INSERT INTO tender_version (
        tender_id, tender_reference, title, closing_at, bid_opening_at,
        department, organisation_chain, location, pincode,
        tender_category, product_category, tender_type,
        tender_value_paise, emd_paise,
        source_sha256, dataset_version_id, first_seen_at, last_seen_at
    ) VALUES (
        OLD.id, OLD.tender_reference, OLD.title, OLD.closing_at, OLD.bid_opening_at,
        OLD.department, OLD.organisation_chain, OLD.location, OLD.pincode,
        OLD.tender_category, OLD.product_category, OLD.tender_type,
        OLD.tender_value_paise, OLD.emd_paise,
        OLD.source_sha256, OLD.dataset_version_id, OLD.first_seen_at, OLD.last_seen_at
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER tender_supersession
    BEFORE UPDATE ON tender
    FOR EACH ROW
    EXECUTE FUNCTION record_tender_supersession();
