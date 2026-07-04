DROP POLICY IF EXISTS "Only admins can delete scripts" ON public.scripts;
CREATE POLICY "Modders delete own scripts without purchases or admins"
ON public.scripts FOR DELETE
USING (
  is_admin(auth.uid())
  OR (
    auth.uid() = modder_id
    AND is_modder(auth.uid())
    AND NOT public.script_has_purchases(id)
  )
);