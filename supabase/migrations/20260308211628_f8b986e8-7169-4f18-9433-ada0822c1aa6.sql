
-- Add is_active column to scripts (default true for existing scripts)
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Function to check if a script has any purchases
CREATE OR REPLACE FUNCTION public.script_has_purchases(_script_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchases WHERE script_id = _script_id
  )
$$;

-- Drop existing delete policy
DROP POLICY IF EXISTS "Modders and admins can delete scripts" ON public.scripts;

-- New delete policy: only admins can delete, and only if script has no purchases
-- (admins can force-delete, but we'll handle purchase check in the app layer for admins)
CREATE POLICY "Only admins can delete scripts"
ON public.scripts
FOR DELETE
USING (is_admin(auth.uid()));
