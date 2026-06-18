-- Store notification API keys for edge functions (service role only)
CREATE TABLE IF NOT EXISTS public.integration_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.integration_secrets FROM anon, authenticated;
