
CREATE TABLE public.forum_reply_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reply_id UUID NOT NULL REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reply_id, user_id)
);

ALTER TABLE public.forum_reply_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are viewable by everyone" ON public.forum_reply_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON public.forum_reply_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own likes" ON public.forum_reply_likes FOR DELETE USING (auth.uid() = user_id);
