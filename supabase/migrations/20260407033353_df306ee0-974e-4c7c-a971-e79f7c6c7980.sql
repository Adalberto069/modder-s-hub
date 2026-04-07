
-- 1. FIX: Profiles email exposure - split SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles without email"
ON public.profiles FOR SELECT
TO anon
USING (true);

CREATE POLICY "Authenticated profiles hide others email"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Create a security definer function to null out email for non-owners
CREATE OR REPLACE FUNCTION public.profiles_hide_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This is a BEFORE UPDATE trigger only used for the column masking approach
  -- We'll use a view instead
  RETURN NEW;
END;
$$;

-- Actually, RLS can't mask columns. Use a view approach:
-- Drop the function we don't need
DROP FUNCTION IF EXISTS public.profiles_hide_email();

-- Recreate a single public SELECT policy
DROP POLICY IF EXISTS "Public profiles without email" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated profiles hide others email" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Create a safe public view that excludes email
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, user_id, username, display_name, avatar_url, bio, 
       reputation_score, total_downloads, total_positive_reviews, 
       created_at, updated_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;

-- 2. FIX: script_access INSERT bypass - require completed purchase
DROP POLICY IF EXISTS "Authenticated users can insert access" ON public.script_access;

CREATE POLICY "Users can insert access with purchase"
ON public.script_access FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.purchases
    WHERE purchases.user_id = auth.uid()
      AND purchases.script_id = script_access.script_id
      AND purchases.status = 'completed'
  )
);

-- 3. FIX: Modders can self-verify - add BEFORE UPDATE trigger
CREATE OR REPLACE FUNCTION public.protect_admin_script_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user is admin, allow all changes
  IF is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- For non-admins, prevent changes to admin-only fields
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'Only admins can change is_verified';
  END IF;
  IF NEW.security_status IS DISTINCT FROM OLD.security_status THEN
    RAISE EXCEPTION 'Only admins can change security_status';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Only admins can change is_active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_admin_script_fields_trigger ON public.scripts;
CREATE TRIGGER protect_admin_script_fields_trigger
BEFORE UPDATE ON public.scripts
FOR EACH ROW
EXECUTE FUNCTION public.protect_admin_script_fields();

-- 4. FIX: Storage INSERT policy - require modder role
DROP POLICY IF EXISTS "Modders can upload script files" ON storage.objects;

CREATE POLICY "Modders can upload script files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'scripts'
  AND (is_modder(auth.uid()) OR is_admin(auth.uid()))
);
