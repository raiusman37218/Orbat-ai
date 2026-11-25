-- Single-use password reset tokens (hashed SHA-256 tokens, 30-minute expiry).
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
  ON public.password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email_created
  ON public.password_reset_tokens (LOWER(email), created_at DESC);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.password_reset_tokens FROM PUBLIC, anon, authenticated;
