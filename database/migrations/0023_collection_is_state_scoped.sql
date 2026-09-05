-- 0023 · Which state a collection window is about, and when it was last tried.
--
-- WHY THE STATE HAS TO BE ON THIS ROW
-- The explorer showed "0 tenders" for Maharashtra. That is a true count and a
-- false statement: no Maharashtra portal is collected at all, so the zero
-- describes our reach and reads as the government's silence. The table could
-- not say otherwise, because a window was keyed only by portal and nothing in
-- the database linked a portal to the state whose tenders it carries.
--
-- The identity is the LGD state code, not the state's name. Names vary by
-- source and get renamed; `admin_unit.lgd_code` is the identity the rest of the
-- ledger already resolves against.
--
-- NULLABLE, BECAUSE BACKFILLING IT WOULD BE INVENTING IT
-- Existing rows were written before the loader recorded a state. The loader now
-- writes it on every run, so the rows fill in as each portal is next collected.
-- A guess from the portal code — `madhyaprades` looks like Madhya Pradesh — is
-- exactly the kind of inference this project does not make in a migration.
ALTER TABLE tender_collection_window
    ADD COLUMN state_lgd_code TEXT;

COMMENT ON COLUMN tender_collection_window.state_lgd_code IS
'LGD code of the state this portal publishes for. NULL until the portal is next collected; never inferred from the portal code.';

-- WHEN WE LAST TRIED, WHICH IS NOT WHEN WE LAST SUCCEEDED.
--
-- `last_success_at` only moves when a run completes, which is right and is why
-- a failed run leaves the previous data and the previous success time standing.
-- But with only that column, a portal checked every hour and failing every hour
-- is indistinguishable from one nobody has looked at since the same moment.
-- The first is a fault to fix; the second is a schedule that stopped.
ALTER TABLE tender_collection_window
    ADD COLUMN last_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN tender_collection_window.last_checked_at IS
'When collection was last attempted, successful or not. last_checked_at later than last_success_at means the most recent attempt did not complete.';

CREATE INDEX tender_collection_window_state_idx
    ON tender_collection_window (state_lgd_code)
    WHERE state_lgd_code IS NOT NULL;
