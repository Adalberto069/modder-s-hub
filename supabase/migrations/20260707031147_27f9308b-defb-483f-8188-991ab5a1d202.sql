ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS apk_version text,
  ADD COLUMN IF NOT EXISTS apk_min_android text,
  ADD COLUMN IF NOT EXISTS apk_package_name text,
  ADD COLUMN IF NOT EXISTS apk_size_mb numeric,
  ADD COLUMN IF NOT EXISTS apk_changelog text,
  ADD COLUMN IF NOT EXISTS apk_original_app text;