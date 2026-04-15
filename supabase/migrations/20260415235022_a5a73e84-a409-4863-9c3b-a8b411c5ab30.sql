
CREATE TABLE public.bounty_test_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  delivery_id UUID NOT NULL REFERENCES public.bounty_deliveries(id) ON DELETE CASCADE,
  bounty_id UUID NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bounty_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test logs"
ON public.bounty_test_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own test logs"
ON public.bounty_test_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_bounty_test_logs_user_delivery ON public.bounty_test_logs (user_id, delivery_id);
