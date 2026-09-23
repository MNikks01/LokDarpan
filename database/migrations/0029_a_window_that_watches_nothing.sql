-- 0029 · A collection window for a portal that is not collected.
--
-- WHAT THE ROW IS
-- `tender_collection_window` holds one row per portal being watched, and its
-- `collecting_since` is the honest floor on the data: below that date, absence
-- means we were not looking. A row therefore asserts something — that this
-- portal is watched from this date.
--
-- `tn` asserts it and nothing backs it. The portal registry has no such code;
-- Tamil Nadu is collected as `tamilnadu`, which holds 32 tenders and the same
-- start date. `tn` holds none, and 0023 could not attach it to a state, so it is
-- the one window that can never report a collection status — it appears in the
-- operator listing forever as a portal nobody can explain.
--
-- It is a naming leftover from before the registry settled, duplicating a window
-- that works.
--
-- WHY REMOVING IT IS NOT LOSING HISTORY
-- The claim it makes is false, and the true version of that claim is already
-- held by `tamilnadu` with the same `collecting_since`. Nothing is forgotten:
-- Tamil Nadu's floor stays exactly where it was.
--
-- The delete is conditional so this is safe on any database. It fires only where
-- the row genuinely watches nothing and the real window exists. On a clean
-- database it matches nothing, which is correct.

DELETE FROM tender_collection_window w
 WHERE w.portal_code = 'tn'
   AND NOT EXISTS (SELECT 1 FROM tender t WHERE t.portal_code = 'tn')
   AND EXISTS (
     SELECT 1 FROM tender_collection_window r WHERE r.portal_code = 'tamilnadu'
   );
