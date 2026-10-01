-- 0038 · A tender cites the page its details were read from.
--
-- WHAT WAS WRONG
-- A tender's department, organisation chain, location, pincode, categories,
-- value and EMD — and through the location, often its district — are read from
-- its own detail page. The row cited only `source_sha256`, the portal's landing
-- page, which states none of them. Until migration 0037 even that page was not
-- kept. So the fields a reader would most want to check pointed at bytes that
-- did not contain them.
--
-- WHAT THIS DOES
-- `detail_sha256` names the stored detail page the tender's details were last
-- read from. The collector puts that page in the raw store before the row that
-- cites it is written (ADR-069). NULL means no detail page was read and kept:
-- every tender loaded before this migration, and any whose page could not be
-- fetched or stored.
--
-- WHAT IT DOES NOT CLAIM
-- A detail page that omits a field does not erase an earlier reading of it (the
-- upsert's COALESCE, unchanged). So `detail_sha256` names the most recent page
-- read, and a field that page left blank keeps the value an earlier page gave.
-- That earlier page is the `detail_sha256` of the tender_version row filed when
-- the field last changed, or of the tender row before this page replaced it.
--
-- A new detail page alone is not a change to the tender: the portal said
-- nothing new. Like `source_sha256`, it is carried into history, never compared.

ALTER TABLE tender
    ADD COLUMN detail_sha256 TEXT REFERENCES source_artifact (sha256);

ALTER TABLE tender_version
    ADD COLUMN detail_sha256 TEXT REFERENCES source_artifact (sha256);

COMMENT ON COLUMN tender.detail_sha256 IS
'The stored detail page this tender''s details were last read from. NULL when none was read and kept. A field that page left blank keeps an earlier page''s reading.';

COMMENT ON COLUMN tender_version.detail_sha256 IS
'The detail page the superseded reading was taken from, where one was kept.';

-- The trigger as 0026 left it, unchanged except that a superseded reading
-- keeps its detail page. 0026's millisecond normalisation must survive: without
-- it every tender whose deadline lost microseconds in transit files a false
-- version each night. SECURITY DEFINER and a pinned search_path for the reasons
-- given in 0009.
CREATE OR REPLACE FUNCTION record_tender_supersession() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
BEGIN
    -- A timestamp that lost precision in transit has not changed (0026).
    IF NEW.closing_at IS NOT NULL AND OLD.closing_at IS NOT NULL
       AND date_trunc('milliseconds', NEW.closing_at)
         = date_trunc('milliseconds', OLD.closing_at)
    THEN
        NEW.closing_at := OLD.closing_at;
    END IF;

    IF NEW.bid_opening_at IS NOT NULL AND OLD.bid_opening_at IS NOT NULL
       AND date_trunc('milliseconds', NEW.bid_opening_at)
         = date_trunc('milliseconds', OLD.bid_opening_at)
    THEN
        NEW.bid_opening_at := OLD.bid_opening_at;
    END IF;

    -- Only what the source controls counts as a change (0022). The pages we
    -- read it from, and when, are ours.
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
        source_sha256, detail_sha256, dataset_version_id, first_seen_at, last_seen_at
    ) VALUES (
        OLD.id, OLD.tender_reference, OLD.title, OLD.closing_at, OLD.bid_opening_at,
        OLD.department, OLD.organisation_chain, OLD.location, OLD.pincode,
        OLD.tender_category, OLD.product_category, OLD.tender_type,
        OLD.tender_value_paise, OLD.emd_paise,
        OLD.source_sha256, OLD.detail_sha256, OLD.dataset_version_id,
        OLD.first_seen_at, OLD.last_seen_at
    );

    RETURN NEW;
END;
$$;
