-- 0013 · What the detail page states, which the landing page does not.
--
-- WHY THIS FOLLOWS 0012 RATHER THAN BEING PART OF IT
-- 0012 was written from the landing page, which publishes four fields and no
-- department, place or value. It recorded that a value column would be null on
-- every row we could collect. That was true of the landing page and is not true
-- of the detail page, which states around seventy-six fields including all
-- three. The schema grows because the evidence changed — and the columns below
-- exist only for fields observed on real pages.
--
-- THE DISTINCTION EVERY LABEL DOWNSTREAM DEPENDS ON
-- `department` and `admin_unit_id` describe the OFFICE THAT ISSUED the tender.
-- They do not state where the work will be done. A Chief Engineer's circle
-- office tenders work across several districts, so a map built on these columns
-- shows "tenders issued by offices in this district" and must say so.

ALTER TABLE tender
    -- First segment of the organisation chain. Reliably present, and the
    -- grouping a reader most wants: which arm of government is buying.
    ADD COLUMN department TEXT,

    -- The chain verbatim, `||` separated as the portal writes it. Kept whole
    -- because the district was derived from it: a reader who doubts the
    -- placement can see exactly what it was read from.
    ADD COLUMN organisation_chain TEXT,

    -- How admin_unit_id was arrived at. `chain_unit` means a segment of the
    -- chain IS that district; `office_code` means the name was found inside an
    -- office name like `CE-Tirunelveli`, whose reach is wider than its own
    -- district. Two different strengths of claim, not merged into one.
    ADD COLUMN district_source TEXT,

    -- The portal's own free-text location. Often an office rather than a place,
    -- so it is displayed as stated and never parsed into a position.
    ADD COLUMN location TEXT,
    ADD COLUMN pincode TEXT,

    ADD COLUMN tender_category TEXT,
    ADD COLUMN product_category TEXT,
    ADD COLUMN tender_type TEXT,

    -- Paise, never a float. NULL where the portal prints "NA", which is most
    -- tenders: an absent value is not a tender worth nothing.
    ADD COLUMN tender_value_paise NUMERIC(20, 2),
    ADD COLUMN emd_paise NUMERIC(20, 2),

    ADD CONSTRAINT tender_district_source_known CHECK (
        district_source IS NULL OR district_source IN ('chain_unit', 'office_code')
    ),
    -- A placement must say how it was reached. Without this a row could carry a
    -- district with no account of where it came from, and the weaker kind of
    -- claim would be indistinguishable from the stronger.
    ADD CONSTRAINT tender_district_source_present CHECK (
        admin_unit_id IS NULL OR district_source IS NOT NULL
    );

COMMENT ON COLUMN tender.department IS
'The arm of government that issued the tender — first segment of the organisation chain.';

COMMENT ON COLUMN tender.district_source IS
'How the district was derived: chain_unit (a chain segment is that district) or office_code (the name sits inside an office name, a weaker claim).';

COMMENT ON COLUMN tender.tender_value_paise IS
'Paise. NULL where the portal prints NA, which is most tenders. Never zero for an unstated value.';

-- The map groups by district and by department, and the filter narrows to one
-- department at a time.
CREATE INDEX tender_department_idx ON tender (department) WHERE department IS NOT NULL;
