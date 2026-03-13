-- Allow public (non-logged) users to view roles for display purposes
CREATE POLICY "Public can view roles"
  ON public.user_roles FOR SELECT
  TO public
  USING (true);