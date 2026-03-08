
-- Add license_duration_days to scripts (null = permanent)
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS license_duration_days integer DEFAULT NULL;

-- Add expires_at to licenses (null = permanent)
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT NULL;
