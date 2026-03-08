-- Allow admins to insert badges for any user (current policy only allows self-insert)
DROP POLICY IF EXISTS "System can insert badges" ON public.user_badges;

CREATE POLICY "Users or admins can insert badges"
ON public.user_badges
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR is_admin(auth.uid())
);

-- Allow admins to delete user badges
DROP POLICY IF EXISTS "Admins can delete user badges" ON public.user_badges;

CREATE POLICY "Admins can delete user badges"
ON public.user_badges
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
