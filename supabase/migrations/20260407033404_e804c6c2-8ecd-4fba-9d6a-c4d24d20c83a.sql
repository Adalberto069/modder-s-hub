
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, user_id, username, display_name, avatar_url, bio, 
       reputation_score, total_downloads, total_positive_reviews, 
       created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;
