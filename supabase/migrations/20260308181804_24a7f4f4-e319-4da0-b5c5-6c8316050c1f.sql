
-- Badge definitions table (scalable: add new badges by inserting rows)
CREATE TABLE public.badge_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'award',
  color text NOT NULL DEFAULT 'hsl(var(--primary))',
  category text NOT NULL DEFAULT 'achievement',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badge definitions viewable by everyone"
  ON public.badge_definitions FOR SELECT USING (true);

CREATE POLICY "Admins can manage badge definitions"
  ON public.badge_definitions FOR ALL
  USING (is_admin(auth.uid()));

-- User badges (junction table)
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges viewable by everyone"
  ON public.user_badges FOR SELECT USING (true);

CREATE POLICY "System can insert badges"
  ON public.user_badges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage user badges"
  ON public.user_badges FOR ALL
  USING (is_admin(auth.uid()));

-- Seed initial badge definitions
INSERT INTO public.badge_definitions (slug, name, description, icon, color, category, sort_order) VALUES
  ('early-member', 'Membro Pioneiro', 'Entrou durante a fase inicial da plataforma', 'clock', 'hsl(45, 90%, 55%)', 'milestone', 1),
  ('script-creator', 'Criador de Script', 'Publicou o primeiro script', 'code', 'hsl(200, 80%, 55%)', 'achievement', 2),
  ('five-scripts', '5 Scripts', 'Publicou cinco scripts', 'layers', 'hsl(160, 70%, 45%)', 'achievement', 3),
  ('thousand-downloads', '1000 Downloads', 'Alcançou 1000 downloads totais', 'download', 'hsl(280, 70%, 55%)', 'milestone', 4),
  ('top-script', 'Top Script', 'Possui um script com avaliação alta', 'trophy', 'hsl(35, 90%, 50%)', 'achievement', 5),
  ('verified-modder', 'Modder Verificado', 'Modder verificado pela equipe', 'shield-check', 'hsl(140, 70%, 45%)', 'status', 6);
