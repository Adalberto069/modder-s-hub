
-- Table to store script security analysis results
CREATE TABLE public.script_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  analyzed_by uuid NOT NULL,
  classification text NOT NULL DEFAULT 'safe',
  security_score integer NOT NULL DEFAULT 100,
  threats jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  functionality text,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.script_analyses ENABLE ROW LEVEL SECURITY;

-- Everyone can view analyses
CREATE POLICY "Analyses viewable by everyone"
  ON public.script_analyses FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert their own analyses
CREATE POLICY "Users can insert analyses"
  ON public.script_analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = analyzed_by);

-- Admins can update analyses (for review)
CREATE POLICY "Admins can update analyses"
  ON public.script_analyses FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can delete analyses
CREATE POLICY "Admins can delete analyses"
  ON public.script_analyses FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Index for quick lookups
CREATE INDEX idx_script_analyses_script_id ON public.script_analyses(script_id);
CREATE INDEX idx_script_analyses_classification ON public.script_analyses(classification);
