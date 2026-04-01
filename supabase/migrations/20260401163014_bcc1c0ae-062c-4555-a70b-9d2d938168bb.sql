
-- 1. Allow modders to view purchases of their scripts
CREATE POLICY "Modders can view purchases of own scripts"
ON public.purchases FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scripts
    WHERE scripts.id = purchases.script_id
    AND scripts.modder_id = auth.uid()
  )
);

-- 2. Create withdrawals table
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modder_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pix_key text,
  pix_key_type text,
  admin_notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Modders can view own withdrawals
CREATE POLICY "Modders can view own withdrawals"
ON public.withdrawals FOR SELECT
TO authenticated
USING (modder_id = auth.uid());

-- Modders can insert own withdrawals
CREATE POLICY "Modders can insert own withdrawals"
ON public.withdrawals FOR INSERT
TO authenticated
WITH CHECK (modder_id = auth.uid());

-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawals FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Admins can update withdrawals
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawals FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));
