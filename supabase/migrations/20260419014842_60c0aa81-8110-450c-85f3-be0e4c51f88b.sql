CREATE TABLE IF NOT EXISTS public.audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'cron',
  total_issues integer NOT NULL DEFAULT 0,
  suspicious_purchases_count integer NOT NULL DEFAULT 0,
  suspicious_bounties_count integer NOT NULL DEFAULT 0,
  orphan_access_count integer NOT NULL DEFAULT 0,
  admins_notified integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_ran_at ON public.audit_runs (ran_at DESC);

ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit runs"
ON public.audit_runs FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- INSERT é feito apenas pelo service role (edge function), que bypassa RLS.
-- Não criamos policy de INSERT para clientes.