-- The login user the scheduler connects as, for local development.
--
-- Separate from the migration for the reason 0008's user is: a password does not
-- belong in migration history. In production this file is not used — the user is
-- created once by hand with a real secret, and only the membership below is the
-- same.
--
--   psql '<owner connection string>' -f database/scripts/create-local-etl-user.sql
--
-- The password here is the local compose password and is deliberately unusable
-- anywhere else.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lokdarpan_etl_user') THEN
        CREATE ROLE lokdarpan_etl_user LOGIN PASSWORD 'lokdarpan_local_only';
    END IF;
END
$$;

-- The user holds no privileges of its own; everything comes from the group role
-- the migration defines, so a change to the grants reaches every credential.
GRANT lokdarpan_etl TO lokdarpan_etl_user;
