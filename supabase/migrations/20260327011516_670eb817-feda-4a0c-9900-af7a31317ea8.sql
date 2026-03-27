-- Drop the trigger and function that depend on the password column, then drop the column
DROP TRIGGER IF EXISTS hash_script_password_trigger ON public.script_passwords;
DROP FUNCTION IF EXISTS public.hash_script_password();
ALTER TABLE public.script_passwords DROP COLUMN IF EXISTS password;