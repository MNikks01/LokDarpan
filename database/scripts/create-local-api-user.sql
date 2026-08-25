-- Local development only. Creates the login user the API connects as, and
-- grants it the read-only role from migration 0002.
--
-- This lives in database/scripts/, not database/migrations/, on purpose: the
-- migrator loads only the migrations directory, so a credential can never enter
-- the migration path or be replayed against a deployed database.
--
-- The password here is local-only and matches docker-compose.yml, which is not
-- a deployment artefact. In any deployed environment this user is created by
-- operations with a managed secret and this file is not used.
--
--   docker exec -i lokdarpan-postgres psql -U lokdarpan -d lokdarpan \
--     < database/scripts/create-local-api-user.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_api') THEN
        CREATE ROLE lokdarpan_api LOGIN PASSWORD 'lokdarpan_local_only';
    END IF;
END
$$;

ALTER ROLE lokdarpan_api NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT lokdarpan_readonly TO lokdarpan_api;
