-- Pure PostgreSQL authentication & MFA schema migration.
-- Eliminates runtime dependency on Supabase Auth (auth.users) while preserving
-- full compatibility with existing workspace/agent rows and UUID identifiers.

-- 1. Keep minimal auth schema stub in case legacy SQL or test helpers reference auth.users
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ensure public.agents has independent UUID generation and pure-PostgreSQL auth/MFA columns
DO $$
DECLARE
  fk RECORD;
BEGIN
  IF to_regclass('public.agents') IS NOT NULL THEN
    ALTER TABLE public.agents
      ALTER COLUMN id SET DEFAULT gen_random_uuid();

    ALTER TABLE public.agents
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ;

    UPDATE public.agents
    SET email_confirmed_at = COALESCE(email_confirmed_at, created_at, now())
    WHERE email_verified = true AND email_confirmed_at IS NULL;
  END IF;

  -- Drop legacy foreign keys referencing Supabase's auth.users so agents, admins,
  -- and workspace owners can be created directly in pure PostgreSQL.
  IF to_regclass('auth.users') IS NOT NULL THEN
    FOR fk IN
      SELECT conname, conrelid::regclass AS tbl
      FROM pg_constraint
      WHERE contype = 'f'
        AND confrelid = to_regclass('auth.users')
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', fk.tbl, fk.conname);
    END LOOP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agents_email_lower
  ON public.agents (LOWER(email));

-- 3. Pure PostgreSQL account registry for pre-onboarding signups, OTP verification,
-- and pre-activation invitations (replaces Supabase auth.users storage cleanly).
CREATE TABLE IF NOT EXISTS public.auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  email_confirmed_at TIMESTAMPTZ,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_email_lower
  ON public.auth_accounts (LOWER(email));

