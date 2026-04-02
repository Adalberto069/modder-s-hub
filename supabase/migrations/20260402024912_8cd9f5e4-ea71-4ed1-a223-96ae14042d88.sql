
CREATE POLICY "Admins can view all mp accounts"
ON public.modder_mp_accounts FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
