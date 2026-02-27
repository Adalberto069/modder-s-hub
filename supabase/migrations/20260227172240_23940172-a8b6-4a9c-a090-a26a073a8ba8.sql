
CREATE TABLE public.tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL DEFAULT 'both' CHECK (platform IN ('android', 'pc', 'both')),
  category TEXT NOT NULL DEFAULT 'utility' CHECK (category IN ('cheat-engine', 'virtualizer', 'utility')),
  external_url TEXT,
  download_url TEXT,
  icon TEXT,
  tags TEXT[] DEFAULT '{}',
  tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tools are viewable by everyone"
ON public.tools FOR SELECT
USING (true);

CREATE POLICY "Admins can manage tools"
ON public.tools FOR ALL
USING (is_admin(auth.uid()));

CREATE TRIGGER update_tools_updated_at
BEFORE UPDATE ON public.tools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
