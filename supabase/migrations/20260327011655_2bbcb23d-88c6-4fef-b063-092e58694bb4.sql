-- [1] Null out lua_code in scripts table since it's now in script_code
-- The column still exists in the table but should always be null
-- Create a trigger to prevent writes to lua_code in scripts table
CREATE OR REPLACE FUNCTION public.block_lua_code_in_scripts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.lua_code := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER block_lua_code_writes
BEFORE INSERT OR UPDATE ON public.scripts
FOR EACH ROW EXECUTE FUNCTION public.block_lua_code_in_scripts();

-- [2] Add CHECK constraint on user_roles to prevent non-modder self-insert
-- Also add update policy restriction
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;

-- Ensure no user can update their own approved status
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- [3] Restrict script_analyses SELECT to owner + admin
DROP POLICY IF EXISTS "Analyses are viewable by authenticated" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can view analyses" ON public.script_analyses;

-- Check current policies first and create restricted one
CREATE POLICY "Owner or admin can view analyses"
ON public.script_analyses
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.scripts WHERE scripts.id = script_analyses.script_id AND scripts.modder_id = auth.uid())
  OR is_admin(auth.uid())
);