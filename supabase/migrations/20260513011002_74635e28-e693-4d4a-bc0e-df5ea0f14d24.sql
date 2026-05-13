-- Restore public read access to profile cards (name, avatar, bio, stats)
-- without exposing emails. We do this with a permissive SELECT RLS policy
-- combined with a column-level revoke on the `email` column.

-- 1) Re-add a public SELECT policy on profiles
DROP POLICY IF EXISTS "Public can view profile cards" ON public.profiles;
CREATE POLICY "Public can view profile cards"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- 2) Revoke column-level access to email from public roles
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;

-- 3) Make sure all other safe columns are explicitly granted
GRANT SELECT (
  id, user_id, username, display_name, avatar_url, bio,
  reputation_score, total_downloads, total_positive_reviews,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;

-- The existing "Owner or admin can view full profile" policy still grants
-- the owner / admins access to the email column via get_my_email() and
-- direct SELECT (they have table-level grants from postgres role chain).