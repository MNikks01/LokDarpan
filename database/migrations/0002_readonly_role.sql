-- 0002 · A read-only role for the API.
--
-- .docs/02-architecture/system-architecture.md: ETL is the only write path to
-- the ledger; everything downstream is read-only. Until now that was a promise
-- made by application code, and the API connected as the database owner — so a
-- defect or an injection in a read path could have written to the canonical
-- record. This makes the database enforce what the code claims.
--
-- The role is NOLOGIN and holds no password: it is a bundle of privileges.
-- A login user is created separately and granted this role, so no credential
-- is ever written into a migration file.
--   * local development -> database/scripts/create-local-api-user.sql
--   * deployed environments -> created by operations, granted this role

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_readonly') THEN
        CREATE ROLE lokdarpan_readonly NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO lokdarpan_readonly;

-- Read every table that exists now...
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lokdarpan_readonly;

-- ...and every table a later migration adds. Without this, a new fact table
-- would be invisible to the API and the failure would look like missing data
-- rather than a missing grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lokdarpan_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO lokdarpan_readonly;

-- Stated explicitly rather than relied upon. A plain GRANT SELECT does not
-- confer the write privileges, but writing this down means a reader of the file
-- does not have to know that to be certain.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON ALL TABLES IN SCHEMA public FROM lokdarpan_readonly;
REVOKE CREATE ON SCHEMA public FROM lokdarpan_readonly;

COMMENT ON ROLE lokdarpan_readonly IS
    'Read-only access to the ledger. Granted to the API login user. ETL writes as the owner.';
