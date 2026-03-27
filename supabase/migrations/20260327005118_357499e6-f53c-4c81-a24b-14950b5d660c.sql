
-- Create trigger to auto-hash passwords on insert/update
CREATE OR REPLACE FUNCTION public.hash_script_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.password IS NOT NULL THEN
    NEW.password_hash := extensions.crypt(NEW.password, extensions.gen_salt('bf', 8));
    -- Clear plaintext password
    NEW.password := '***';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hash_script_password_trigger
BEFORE INSERT OR UPDATE OF password ON public.script_passwords
FOR EACH ROW
EXECUTE FUNCTION public.hash_script_password();

-- Clear existing plaintext passwords (already hashed above)
UPDATE public.script_passwords SET password = '***' WHERE password != '***';
