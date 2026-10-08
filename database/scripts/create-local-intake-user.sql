-- Local development only. Creates the login user the site's correction form
-- connects as, and grants it the intake role from migration 0046.
--
-- Kept out of database/migrations/ for the same reason as the other users: a
-- credential must never enter the migration path or be replayed against a
-- deployed database. In any deployed environment this user is created by
-- operations with a managed secret, and this file is not used.
--
--   docker exec -i lokdarpan-postgres psql -U lokdarpan -d lokdarpan \
--     < database/scripts/create-local-intake-user.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_intake_user') THEN
        CREATE ROLE lokdarpan_intake_user LOGIN PASSWORD 'lokdarpan_local_only';
    END IF;
END
$$;

ALTER ROLE lokdarpan_intake_user NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT lokdarpan_intake TO lokdarpan_intake_user;
