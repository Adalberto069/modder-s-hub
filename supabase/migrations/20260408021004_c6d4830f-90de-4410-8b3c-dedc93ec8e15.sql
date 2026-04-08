
-- Add test/dispute columns to bounty_deliveries
ALTER TABLE public.bounty_deliveries
  ADD COLUMN test_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN disputed boolean NOT NULL DEFAULT false,
  ADD COLUMN dispute_reason text,
  ADD COLUMN dispute_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN dispute_resolved_by uuid;

-- Allow requester to update delivery (approve/dispute)
CREATE POLICY "Requester can update delivery" ON public.bounty_deliveries
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bounties b
    WHERE b.id = bounty_deliveries.bounty_id
    AND b.requester_id = auth.uid()
  )
);
