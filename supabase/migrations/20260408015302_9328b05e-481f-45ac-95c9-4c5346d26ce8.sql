
CREATE POLICY "Admins can delete bounty purchases"
ON public.bounty_purchases FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));
