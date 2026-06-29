
CREATE TABLE public.script_upload_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  reason text NOT NULL,
  source text NOT NULL CHECK (source IN ('pasted_code','uploaded_file')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.script_upload_blocks IS 'MODERATION: tentativas de upload de script bloqueadas pelo detector de ofuscação.';

CREATE INDEX idx_script_upload_blocks_user_id_created ON public.script_upload_blocks(user_id, created_at DESC);
CREATE INDEX idx_script_upload_blocks_created ON public.script_upload_blocks(created_at DESC);

GRANT SELECT, INSERT ON public.script_upload_blocks TO authenticated;
GRANT ALL ON public.script_upload_blocks TO service_role;

ALTER TABLE public.script_upload_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own blocked attempts"
  ON public.script_upload_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own blocked attempts"
  ON public.script_upload_blocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all blocked attempts"
  ON public.script_upload_blocks
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
