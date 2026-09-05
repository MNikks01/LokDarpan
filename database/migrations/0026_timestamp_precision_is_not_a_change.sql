-- 0026 · A timestamp that lost its microseconds in transit has not changed.
--
-- THE DEFECT, RECORDED IN ADR-049 WHEN 0022 WAS WRITTEN
-- The trigger compares timestamps exactly. PostgreSQL stores microseconds;
-- a JavaScript `Date` carries milliseconds. So a caller that reads a closing
-- date back and writes it again unchanged — which no loader does today, and any
-- correction tool would — hands back 12:00:00.123 where 12:00:00.123789 was
-- stored. The trigger sees a different value, files a version, and the ledger
-- records that a government office moved a deadline it never touched.
--
-- WHY NOT DECLARE THE COLUMN timestamptz(3)
-- It was the obvious fix and it is wrong. A cast to timestamptz(3) ROUNDS:
-- .123789 becomes .124. The driver TRUNCATES: .123789 becomes .123. Storing a
-- rounded .124 and receiving a truncated .123 leaves the two unequal, so the
-- spurious version survives the change that was supposed to prevent it. Measured
-- against this database rather than assumed.
--
-- date_trunc('milliseconds', …) truncates, which is exactly what the driver
-- does, so the two agree by construction.
--
-- WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT
-- Where the two readings agree to the millisecond, the OLD value is restored
-- into NEW before any comparison. Two consequences, both wanted:
--
--   * the comparison below is untouched — it still tests exact equality, and
--     every non-timestamp field behaves exactly as before;
--   * the stored microseconds SURVIVE. A lossy round trip no longer quietly
--     shortens a stored timestamp, which a comparison that merely ignored the
--     difference would have allowed.
--
-- A real change of a millisecond or more still differs after truncation and
-- still files a version. No source in this project publishes a tender deadline
-- to finer than a minute, so nothing observable is being rounded away.

CREATE OR REPLACE FUNCTION record_tender_supersession() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only when both are present. A timestamp appearing or disappearing is a
    -- real change, and the comparison below reports it.
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
