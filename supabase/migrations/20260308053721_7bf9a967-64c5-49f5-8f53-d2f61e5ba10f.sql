
-- Drop old restrictive INSERT and UPDATE policies on scripts
DROP POLICY IF EXISTS "Modders can insert scripts" ON public.scripts;
DROP POLICY IF EXISTS "Modders can update own scripts" ON public.scripts;

-- Allow admins and modders to insert scripts
CREATE POLICY "Modders and admins can insert scripts"
ON public.scripts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = modder_id
  AND (is_modder(auth.uid()) OR is_admin(auth.uid()))
);

-- Allow admins to update any script, modders only their own
CREATE POLICY "Modders and admins can update scripts"
ON public.scripts
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = modder_id AND is_modder(auth.uid()))
  OR is_admin(auth.uid())
);
