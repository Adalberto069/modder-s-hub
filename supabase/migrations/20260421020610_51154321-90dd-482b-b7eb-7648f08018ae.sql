
-- =========================================================
-- 1) PROFILES: hide email from public; keep public profile info
-- =========================================================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Owner or admin can read the full profile row (including email)
CREATE POLICY "Owner or admin can view full profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Public/anon can view profiles only via the safe view (profiles_public)
-- Recreate profiles_public view WITHOUT email and as security_invoker
DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  username,
  display_name,
  avatar_url,
  bio,
  reputation_score,
  total_downloads,
  total_positive_reviews,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Allow anon/authenticated to read non-sensitive columns directly too (without email)
-- We keep RLS strict on profiles. Public reads should go through profiles_public view.
-- However, many existing queries select from profiles directly. Provide a permissive
-- public SELECT but rely on the application/view to avoid exposing email.
-- To truly hide email at the row level we add a column-level guard via a trigger-like
-- approach: revoke the email column from anon/authenticated and grant other columns.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, username, display_name, avatar_url, bio,
              reputation_score, total_downloads, total_positive_reviews,
              created_at, updated_at)
  ON public.profiles TO anon, authenticated;
-- Owner/admin policy already restricts full-row reads; column grant lets public
-- read the safe columns but NOT email.
CREATE POLICY "Public can view non-sensitive profile columns"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- =========================================================
-- 2) BOUNTY_APPLICATIONS: restrict to participants + admins
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view bounty applications" ON public.bounty_applications;

CREATE POLICY "Participants and admins can view applications"
  ON public.bounty_applications FOR SELECT
  TO authenticated
  USING (
    modder_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_applications.bounty_id
        AND b.requester_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =========================================================
-- 3) SCRIPTS: hide archived/rejected from public
-- =========================================================
DROP POLICY IF EXISTS "Published scripts are viewable by everyone" ON public.scripts;

CREATE POLICY "Public can view active published scripts"
  ON public.scripts FOR SELECT
  TO anon, authenticated
  USING (
    publish_status = 'published'
    AND is_active = true
    AND security_status <> 'rejected'
  );

CREATE POLICY "Owners and admins can view all own scripts"
  ON public.scripts FOR SELECT
  TO authenticated
  USING (modder_id = auth.uid() OR public.is_admin(auth.uid()));

-- =========================================================
-- 4) REALTIME: scope channel subscription by bounty participation
-- =========================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bounty participants can subscribe to bounty channels" ON realtime.messages;
CREATE POLICY "Bounty participants can subscribe to bounty channels"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    -- For bounty channels named "bounty:<uuid>", only participants/admins can read
    CASE
      WHEN realtime.topic() LIKE 'bounty:%' THEN EXISTS (
        SELECT 1 FROM public.bounties b
        WHERE b.id::text = split_part(realtime.topic(), ':', 2)
          AND (b.requester_id = auth.uid() OR b.assigned_modder_id = auth.uid())
      ) OR public.is_admin(auth.uid())
      ELSE true
    END
  );

DROP POLICY IF EXISTS "Authenticated can broadcast to allowed channels" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast to allowed channels"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE
      WHEN realtime.topic() LIKE 'bounty:%' THEN EXISTS (
        SELECT 1 FROM public.bounties b
        WHERE b.id::text = split_part(realtime.topic(), ':', 2)
          AND (b.requester_id = auth.uid() OR b.assigned_modder_id = auth.uid())
      ) OR public.is_admin(auth.uid())
      ELSE true
    END
  );
