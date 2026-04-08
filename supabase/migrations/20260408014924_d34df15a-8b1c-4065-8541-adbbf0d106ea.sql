
CREATE TABLE public.bounty_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL,
  modder_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  fee NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0.20,
  platform_commission NUMERIC NOT NULL DEFAULT 0,
  modder_earnings NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'pix',
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bounty_purchases ENABLE ROW LEVEL SECURITY;

-- Requester can create payment
CREATE POLICY "Payer can insert bounty purchase"
ON public.bounty_purchases FOR INSERT TO authenticated
WITH CHECK (payer_id = auth.uid());

-- Participants and admins can view
CREATE POLICY "Participants can view bounty purchases"
ON public.bounty_purchases FOR SELECT TO authenticated
USING (payer_id = auth.uid() OR modder_id = auth.uid() OR public.is_admin(auth.uid()));

-- Service role updates via webhook (no user-facing update needed)
CREATE POLICY "Admins can update bounty purchases"
ON public.bounty_purchases FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));
