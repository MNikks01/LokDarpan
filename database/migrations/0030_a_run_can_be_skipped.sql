-- 0030 · A sweep that never started is not a sweep that failed.
--
-- The scheduler takes a database advisory lock before collecting, so a run that
-- begins while another is still going stops without touching a portal. That
-- outcome is not `failed` — nothing was attempted and nothing went wrong — and
-- it is not `succeeded`, because no collection happened.
--
-- Recording it as `failed` would put a fault in front of an operator that does
-- not exist, and would make a healthy overlap look identical to a portal
-- refusing us. Recording nothing at all would leave a scheduled run with no
-- trace, which is the failure mode this table was added to prevent.
--
-- The existing three values cannot express it, so a fourth is added rather than
-- one of them stretched.

ALTER TYPE ingestion_run_status ADD VALUE 'skipped';
