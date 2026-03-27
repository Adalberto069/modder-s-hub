-- [1] Drop the old permissive analyses policy
DROP POLICY IF EXISTS "Analyses viewable by everyone" ON public.script_analyses;

-- [2] Fix user_roles INSERT policy to enforce approved = false
DROP POLICY IF EXISTS "Users can request modder role" ON public.user_roles;

CREATE POLICY "Users can request modder role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'modder'::public.app_role
  AND approved = false
);

-- [3] Remove lua_code column from scripts table entirely (data already migrated to script_code)
ALTER TABLE public.scripts DROP COLUMN IF EXISTS lua_code CASCADE;

-- [4] Move file_url access control: create a function to get file_url only for authorized users
CREATE OR REPLACE FUNCTION public.get_script_file_url(_script_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.file_url FROM public.scripts s
  WHERE s.id = _script_id
  AND (
    s.is_paid = false
    OR s.modder_id = auth.uid()
    OR is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.purchases p WHERE p.script_id = _script_id AND p.user_id = auth.uid() AND p.status = 'completed')
    OR EXISTS (SELECT 1 FROM public.licenses l WHERE l.script_id = _script_id AND l.user_id = auth.uid() AND l.status = 'active')
  )
$$;