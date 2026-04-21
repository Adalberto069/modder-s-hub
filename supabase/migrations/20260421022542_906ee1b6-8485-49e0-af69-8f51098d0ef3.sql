-- 1) Remove the overly-permissive public SELECT policy on profiles.
-- The existing "Owner or admin can view full profile" policy stays.
-- Public reads should go through the public.profiles_public view (already excludes email).
DROP POLICY IF EXISTS "Public can view non-sensitive profile columns" ON public.profiles;

-- Ensure anon/authenticated can read the safe view
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2) Tighten realtime broadcast policy: drop fallback `true`, restrict to bounty participants.
DROP POLICY IF EXISTS "Authenticated can broadcast to allowed channels" ON realtime.messages;

CREATE POLICY "Authenticated can broadcast to bounty channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'bounty:%'
  AND EXISTS (
    SELECT 1 FROM public.bounties b
    WHERE b.id::text = split_part(realtime.topic(), ':', 2)
      AND (
        b.requester_id = auth.uid()
        OR b.assigned_modder_id = auth.uid()
        OR public.is_admin(auth.uid())
      )
  )
);