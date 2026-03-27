-- [1] Add SELECT policy on script_passwords: only script owner can read
CREATE POLICY "Only script owner can read passwords"
ON public.script_passwords
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.scripts
  WHERE scripts.id = script_passwords.script_id
  AND scripts.modder_id = auth.uid()
));

-- [2] Restrict tutorial_ratings to authenticated users only
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.tutorial_ratings;

CREATE POLICY "Authenticated users can view ratings"
ON public.tutorial_ratings
FOR SELECT
TO authenticated
USING (true);