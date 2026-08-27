-- Local development only. Creates the login user the review tool connects as,
-- and grants it the reviewer role from migration 0008.
--
-- Kept out of database/migrations/ for the same reason as the API user: the
-- migrator loads only the migrations directory, so a credential can never
-- enter the migration path or be replayed against a deployed database.
--
-- The password here is local-only and matches docker-compose.yml, which is not
-- a deployment artefact. In any deployed environment this user is created by
-- operations with a managed secret and this file is not used.
--
--   docker exec -i lokdarpan-postgres psql -U lokdarpan -d lokdarpan \
--     < database/scripts/create-local-reviewer-user.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_review') THEN
        CREATE ROLE lokdarpan_review LOGIN PASSWORD 'lokdarpan_local_only';
    END IF;
END
$$;

ALTER ROLE lokdarpan_review NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT lokdarpan_reviewer TO lokdarpan_review;
