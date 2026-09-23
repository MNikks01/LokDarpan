-- 0031 · The credential the scheduler runs as.
--
-- WHY NOT THE OWNER
-- Ingestion has always run as the database owner, which was tolerable while it
-- ran by hand from a trusted machine. A scheduled run means the credential lives
-- in GitHub, and an owner credential there can drop the ledger. The privileges
-- below are what the GEP-NIC pipeline actually uses, derived by reading every
-- statement it issues rather than by starting from ownership and removing what
-- seemed unnecessary.
--
-- The shape follows 0008: a NOLOGIN group role holding the grants, with the
-- login user created separately, so the password never enters a migration.
--
-- WHAT THE PIPELINE DOES, STATEMENT BY STATEMENT
--   SELECT admin_unit                 · resolve a portal's districts
--   INSERT source_artifact            · store the bytes a run read
--   INSERT dataset_version RETURNING  · open the vintage the run writes under
--   INSERT/UPDATE tender RETURNING    · the upsert, reading the existing row
--   SELECT tender_version             · count the versions this run caused
--   INSERT/UPDATE tender_collection_window · the observation window
--   INSERT/UPDATE ingestion_run RETURNING  · the account of the run
--
-- SELECT accompanies every INSERT that uses RETURNING, because RETURNING reads
-- the columns it returns.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_etl') THEN
        CREATE ROLE lokdarpan_etl NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO lokdarpan_etl;

-- Read-only inputs. The pipeline resolves districts and reads how much history
-- it caused; it writes neither.
--
-- `tender_version` is SELECT and not INSERT on purpose. History is written by
-- the trigger from migration 0022, which is SECURITY DEFINER and therefore runs
-- as the table owner. Granting INSERT here would let the ETL role write history
-- directly, which is exactly what making the trigger SECURITY DEFINER was for.
GRANT SELECT ON admin_unit, tender_version TO lokdarpan_etl;

-- The write surface, named table by table.
GRANT SELECT, INSERT ON source_artifact, dataset_version TO lokdarpan_etl;
GRANT SELECT, INSERT, UPDATE ON tender, tender_collection_window, ingestion_run
    TO lokdarpan_etl;

-- `tender.id` is BIGSERIAL, so its sequence needs USAGE. Every other table the
-- pipeline writes uses GENERATED ALWAYS AS IDENTITY, which needs no sequence
-- grant of its own.
GRANT USAGE ON SEQUENCE tender_id_seq TO lokdarpan_etl;

-- Stated rather than assumed. A grant that was never made is not a guarantee
-- until something says it must not exist: nothing in this pipeline deletes a
-- tender, empties a table, or changes the schema, and a scheduled credential
-- that could is a larger blast radius than the job needs.
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public
    FROM lokdarpan_etl;
REVOKE CREATE ON SCHEMA public FROM lokdarpan_etl;

-- No default privileges are granted. A table added by a future migration is
-- invisible to this role until a migration says otherwise, so the surface can
-- only grow deliberately — the opposite of the choice 0002 makes for the
-- read-only role, and right for a writer.

COMMENT ON ROLE lokdarpan_etl IS
'Ingestion. May write tenders, their collection windows and ingestion runs, and read the admin hierarchy. Cannot delete, cannot change the schema, and cannot write tender history directly — the trigger does that as owner.';
