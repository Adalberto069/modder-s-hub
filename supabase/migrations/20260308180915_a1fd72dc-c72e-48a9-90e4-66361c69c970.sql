
-- Drop the public SELECT policy on tutorials
DROP POLICY IF EXISTS "Tutorials are viewable by everyone" ON public.tutorials;

-- Create new policy: only authenticated users can view tutorials
CREATE POLICY "Tutorials viewable by authenticated users"
  ON public.tutorials
  FOR SELECT
  TO authenticated
  USING (true);
