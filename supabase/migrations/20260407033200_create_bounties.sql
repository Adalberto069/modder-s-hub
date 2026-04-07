-- Create bounties table
CREATE TABLE IF NOT EXISTS public.bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  game_name TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  reward_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_modder_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create bounty_applications table
CREATE TABLE IF NOT EXISTS public.bounty_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  modder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bounty_id, modder_id)
);

-- Trigger to update updated_at on bounties
CREATE OR REPLACE FUNCTION public.update_bounties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bounties_updated_at
  BEFORE UPDATE ON public.bounties
  FOR EACH ROW EXECUTE FUNCTION public.update_bounties_updated_at();

-- Enable RLS
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Bounties
-- Anyone can view non-cancelled bounties
CREATE POLICY "Anyone can view bounties"
  ON public.bounties FOR SELECT
  USING (status != 'cancelled' OR requester_id = auth.uid());

-- Authenticated users can create bounties
CREATE POLICY "Authenticated users can create bounties"
  ON public.bounties FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Requester can update their own bounty (status, description, etc.)
CREATE POLICY "Requester can update their bounty"
  ON public.bounties FOR UPDATE
  TO authenticated
  USING (requester_id = auth.uid() OR public.is_admin(auth.uid()));

-- Requester can cancel/delete their bounty
CREATE POLICY "Requester can delete their bounty"
  ON public.bounties FOR DELETE
  TO authenticated
  USING (requester_id = auth.uid() OR public.is_admin(auth.uid()));

-- RLS Policies: Bounty Applications
-- Anyone can view applications for a bounty
CREATE POLICY "Anyone can view bounty applications"
  ON public.bounty_applications FOR SELECT
  USING (true);

-- Authenticated (modder) users can apply
CREATE POLICY "Modders can apply to bounties"
  ON public.bounty_applications FOR INSERT
  TO authenticated
  WITH CHECK (modder_id = auth.uid());

-- Modder can update their own application
CREATE POLICY "Modder can update own application"
  ON public.bounty_applications FOR UPDATE
  TO authenticated
  USING (modder_id = auth.uid());

-- Bounty requester can accept/reject applications (via status update on bounties)
CREATE POLICY "Requester can update application status"
  ON public.bounty_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties
      WHERE bounties.id = bounty_applications.bounty_id
        AND bounties.requester_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );
