
-- Tutorial comments
CREATE TABLE public.tutorial_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id UUID NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone" ON public.tutorial_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.tutorial_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.tutorial_comments
  FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users can update own comments" ON public.tutorial_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Tutorial ratings
CREATE TABLE public.tutorial_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id UUID NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tutorial_id, user_id)
);

ALTER TABLE public.tutorial_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are viewable by everyone" ON public.tutorial_ratings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can rate" ON public.tutorial_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rating" ON public.tutorial_ratings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rating" ON public.tutorial_ratings
  FOR DELETE USING (auth.uid() = user_id);
