
-- Table for script passwords (protection for paid scripts)
CREATE TABLE public.script_passwords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  password TEXT NOT NULL,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(script_id)
);

-- Table for tracking script access (who unlocked which script)
CREATE TABLE public.script_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(script_id, user_id)
);

-- RLS for script_passwords
ALTER TABLE public.script_passwords ENABLE ROW LEVEL SECURITY;

-- Only the script owner (modder) can manage passwords
CREATE POLICY "Modders can manage own script passwords"
  ON public.script_passwords FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scripts
      WHERE scripts.id = script_passwords.script_id
      AND scripts.modder_id = auth.uid()
    )
  );

-- RLS for script_access
ALTER TABLE public.script_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own access
CREATE POLICY "Users can view own access"
  ON public.script_access FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert access (validated by edge function)
CREATE POLICY "Authenticated users can insert access"
  ON public.script_access FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Edge function to validate password - using a DB function
CREATE OR REPLACE FUNCTION public.validate_script_password(
  _script_id UUID,
  _password TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.script_passwords
    WHERE script_id = _script_id
    AND password = _password
    AND (is_permanent = true OR expires_at > now())
  )
$$;
