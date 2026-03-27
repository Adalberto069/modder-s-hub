
-- [1] Remove plaintext password column from script_passwords
ALTER TABLE public.script_passwords ALTER COLUMN password DROP NOT NULL;
ALTER TABLE public.script_passwords ALTER COLUMN password SET DEFAULT NULL;

-- Update validate_script_password to use password_hash instead of plaintext
CREATE OR REPLACE FUNCTION public.validate_script_password(_script_id uuid, _password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.script_passwords
    WHERE script_id = _script_id
    AND password_hash = extensions.crypt(_password, password_hash)
    AND (is_permanent = true OR expires_at > now())
  )
$$;

-- Clear any remaining plaintext passwords
UPDATE public.script_passwords SET password = NULL WHERE password IS NOT NULL;

-- [2] Remove self-insert badge policy, keep admin-only
DROP POLICY IF EXISTS "Users or admins can insert badges" ON public.user_badges;

-- [3] Restrict user_roles SELECT to own rows + admin, drop public policies
DROP POLICY IF EXISTS "Public can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin(auth.uid()));
