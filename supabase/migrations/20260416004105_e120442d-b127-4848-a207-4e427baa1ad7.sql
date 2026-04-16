
CREATE TABLE public.script_test_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, script_id)
);

ALTER TABLE public.script_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test logs"
ON public.script_test_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own test logs"
ON public.script_test_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
