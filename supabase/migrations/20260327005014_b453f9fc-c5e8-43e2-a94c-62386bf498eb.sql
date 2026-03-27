
-- Add password_hash column
ALTER TABLE public.script_passwords ADD COLUMN IF NOT EXISTS password_hash text;

-- Hash existing passwords
UPDATE public.script_passwords 
SET password_hash = extensions.crypt(password, extensions.gen_salt('bf', 8))
WHERE password_hash IS NULL AND password IS NOT NULL;
