-- 0041 · A fact names the field it fills.
--
-- WHY
-- Tender notices are read into `document_fact` the way CAG reports are: each
-- value tied to its page and to the words it was read from, unpublished until a
-- person checks it (ADR-068). But a notice states several amounts — the tender
-- value, the EMD, the tender fee, a processing fee — and several dates. As
-- `monetary_amount` rows they are indistinguishable except by re-reading their
-- raw text, and a later step that assembles a tender from them would have to
-- guess which amount is which. A guess is exactly what this ledger refuses.
--
-- WHAT THIS DOES
-- · `fact_kind` gains `tender_identifier` (a GePNIC tender ID, an issuer's
--   reference, a notice number) and `tender_date` (a publication, submission,
--   opening or meeting date). Amounts stay `monetary_amount`.
-- · `document_fact.field` names which field of a notice a fact fills, in
--   snake case: `tender_value`, `emd`, `tender_fee`, `gepnic_tender_id`,
--   `bid_submission_end` and so on. NULL for the CAG facts, which fill no form.
--
-- The new values are only added here; PostgreSQL will not let a new enum value
-- be used in the transaction that adds it, so nothing is written with them in
-- this migration.

ALTER TYPE fact_kind ADD VALUE 'tender_identifier';
ALTER TYPE fact_kind ADD VALUE 'tender_date';

ALTER TABLE document_fact
    ADD COLUMN field TEXT,
    ADD CONSTRAINT document_fact_field_named CHECK (field IS NULL OR field ~ '^[a-z][a-z0-9_]*$');

COMMENT ON COLUMN document_fact.field IS
    'Which field of a form-like document this fact fills (tender_value, emd, gepnic_tender_id, bid_submission_end …). NULL for facts that fill no form, such as figures in an audit report.';
