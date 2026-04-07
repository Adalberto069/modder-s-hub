
-- 1. Fix trigger to allow service role / edge function context
CREATE OR REPLACE FUNCTION public.protect_admin_script_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role (edge functions, webhooks, triggers) - auth.uid() is null
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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

-- 2. Create private bucket for script .lua files
INSERT INTO storage.buckets (id, name, public)
VALUES ('scripts-private', 'scripts-private', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for scripts-private: only modders/admins can upload
CREATE POLICY "Modders can upload to scripts-private"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'scripts-private'
  AND (is_modder(auth.uid()) OR is_admin(auth.uid()))
);

-- Only owners can read their own files in scripts-private
CREATE POLICY "Owners can read own script files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'scripts-private'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Admins can read all files in scripts-private
CREATE POLICY "Admins can read all private scripts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'scripts-private'
  AND is_admin(auth.uid())
);

-- Modders can update/delete their own files
CREATE POLICY "Modders can update own private files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'scripts-private'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Modders can delete own private files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'scripts-private'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3. Revoke email column from anon role  
REVOKE SELECT (email) ON public.profiles FROM anon;
