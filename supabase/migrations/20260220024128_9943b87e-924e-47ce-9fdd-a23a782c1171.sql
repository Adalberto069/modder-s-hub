
-- Add video_url and is_verified to scripts
ALTER TABLE public.scripts ADD COLUMN video_url text;
ALTER TABLE public.scripts ADD COLUMN is_verified boolean NOT NULL DEFAULT false;

-- Script gallery images
CREATE TABLE public.script_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.script_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Script images are viewable by everyone"
ON public.script_images FOR SELECT USING (true);

CREATE POLICY "Modders can manage own script images"
ON public.script_images FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.scripts WHERE id = script_id AND modder_id = auth.uid())
);

CREATE POLICY "Modders can delete own script images"
ON public.script_images FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.scripts WHERE id = script_id AND modder_id = auth.uid())
);

-- Tutorials table
CREATE TABLE public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  content text,
  category text NOT NULL DEFAULT 'geral',
  video_url text,
  thumbnail_url text,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutorials are viewable by everyone"
ON public.tutorials FOR SELECT USING (true);

CREATE POLICY "Admins can manage tutorials"
ON public.tutorials FOR ALL USING (is_admin(auth.uid()));

CREATE TRIGGER update_tutorials_updated_at
BEFORE UPDATE ON public.tutorials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
