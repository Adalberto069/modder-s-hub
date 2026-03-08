
-- Add new columns to scripts table
ALTER TABLE public.scripts 
  ADD COLUMN IF NOT EXISTS game_name text,
  ADD COLUMN IF NOT EXISTS version text DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lua_code text,
  ADD COLUMN IF NOT EXISTS related_tutorial_id uuid REFERENCES public.tutorials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publish_status text DEFAULT 'published' NOT NULL;

-- Add comment explaining publish_status values: draft, pending_review, published, archived
COMMENT ON COLUMN public.scripts.publish_status IS 'Publication workflow status: draft, pending_review, published, archived';
