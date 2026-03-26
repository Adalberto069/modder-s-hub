
-- Add foreign key from user_roles to profiles to allow easier joins
-- Ensure we handle existing constraints if any, but since user_id is unique in profiles, this is safe.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey_profiles'
  ) THEN
    ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_user_id_fkey_profiles 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);
  END IF;
END $$;
