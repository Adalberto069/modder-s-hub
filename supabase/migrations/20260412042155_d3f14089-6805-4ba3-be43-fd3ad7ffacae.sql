
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS code_hash text;

CREATE INDEX IF NOT EXISTS idx_scripts_code_hash ON public.scripts (code_hash) WHERE code_hash IS NOT NULL;
