-- 0037 · An artefact says where its bytes are.
--
-- WHAT WENT WRONG
-- `source_artifact` promised that every fact points back to the bytes it came
-- from. On 29 September 2026 the production ledger held 163 artefacts, and:
--
--   · 125 GePNIC landing pages and 37 OpenStreetMap responses were hashed in
--     memory and never written anywhere. Their `storage_path` names a file that
--     was never created. The sweep runs on a GitHub runner, deleted with the job.
--   · 1 LGD page was written to the disk of the machine that ran the load, and
--     exists nowhere else.
--
-- Nothing in the row distinguished "held in a durable store" from "hashed and
-- discarded", so the gap was invisible until someone went looking for a file.
--
-- WHAT THIS DOES
-- `stored_in` names the store that holds the bytes: `file` for a local
-- directory, `s3://<bucket>` for an object store. It is required for every row
-- written from now on.
--
-- The constraint is NOT VALID on purpose. The rows that predate it keep a NULL,
-- which is the true statement about them: this ledger did not retain their
-- bytes. Filling it with a guess would repeat the original mistake. A backfill
-- that actually copies an artefact's bytes into the object store may set it,
-- after verifying the hash (`.docs/16-operations/raw-store.md`).

ALTER TABLE source_artifact
    ADD COLUMN stored_in TEXT,
    ADD CONSTRAINT source_artifact_bytes_stored CHECK (
        stored_in IS NOT NULL AND (stored_in = 'file' OR stored_in LIKE 's3://_%')
    ) NOT VALID;

COMMENT ON COLUMN source_artifact.stored_in IS
    'Which store holds the bytes: file (a local directory) or s3://<bucket>. NULL only on rows written before 2026-09-29, whose bytes this ledger did not retain.';
