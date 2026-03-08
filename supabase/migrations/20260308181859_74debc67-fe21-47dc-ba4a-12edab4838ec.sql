
-- Allow anyone authenticated to view roles (needed for public profile role display)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);
