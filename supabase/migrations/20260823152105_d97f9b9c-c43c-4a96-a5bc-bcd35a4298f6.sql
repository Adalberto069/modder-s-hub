CREATE TABLE public.script_test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  access_code text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 3,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.script_test_sessions TO authenticated;
GRANT ALL ON public.script_test_sessions TO service_role;

ALTER TABLE public.script_test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test sessions"
ON public.script_test_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE INDEX idx_script_test_sessions_user ON public.script_test_sessions(user_id, created_at DESC);