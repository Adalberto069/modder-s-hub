
-- ============================================================
-- 1. PAYMENT BYPASS FIX
-- ============================================================

-- Change the default status so rows aren't auto-marked completed
ALTER TABLE public.purchases ALTER COLUMN status SET DEFAULT 'pending';

-- Replace the permissive INSERT policy on purchases:
-- client-side inserts must be 'pending'. Edge functions (service role) bypass RLS.
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own pending purchases"
ON public.purchases
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Lock down script_access: clients should NOT self-grant access.
-- Only the service role (edge function / webhook) may insert.
DROP POLICY IF EXISTS "Users can insert access with purchase" ON public.script_access;

-- ============================================================
-- 2. EMAIL EXPOSURE FIX (profiles table)
-- ============================================================

-- Replace the public-everyone SELECT policy with a column-aware setup:
-- - public can still see profiles (needed for the marketplace),
-- - but the email column is restricted via a column-level grant.
-- Strategy: revoke email column from anon/authenticated, allow only owner & admins via a SECURITY DEFINER function if needed.

-- Revoke direct SELECT on the email column for public roles
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;

-- Re-grant SELECT on all OTHER columns explicitly to maintain functionality
GRANT SELECT (
  id, user_id, username, display_name, avatar_url, bio,
  reputation_score, total_downloads, total_positive_reviews,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;

-- Provide a SECURITY DEFINER helper so owners/admins can still fetch their own email
CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_email() TO authenticated;
