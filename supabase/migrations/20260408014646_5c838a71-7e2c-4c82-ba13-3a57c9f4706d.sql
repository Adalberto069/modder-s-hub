
-- Allow admins to delete bounty_applications
CREATE POLICY "Admins can delete applications"
ON public.bounty_applications
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to delete bounty_messages
CREATE POLICY "Admins can delete bounty messages"
ON public.bounty_messages
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
