
-- Table for secure bounty deliveries (escrow)
CREATE TABLE public.bounty_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bounty_id uuid NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  modder_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  delivered_at timestamp with time zone NOT NULL DEFAULT now(),
  released boolean NOT NULL DEFAULT false,
  released_at timestamp with time zone
);

ALTER TABLE public.bounty_deliveries ENABLE ROW LEVEL SECURITY;

-- Modder can upload delivery
CREATE POLICY "Modder can insert delivery" ON public.bounty_deliveries
FOR INSERT TO authenticated
WITH CHECK (
  modder_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM bounties b
    WHERE b.id = bounty_deliveries.bounty_id
    AND b.assigned_modder_id = auth.uid()
    AND b.status = 'in_progress'
  )
);

-- Both participants and admins can view deliveries (but file_url is protected by edge function)
CREATE POLICY "Participants can view deliveries" ON public.bounty_deliveries
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bounties b
    WHERE b.id = bounty_deliveries.bounty_id
    AND (b.requester_id = auth.uid() OR b.assigned_modder_id = auth.uid())
  )
  OR is_admin(auth.uid())
);

-- Admins can delete deliveries
CREATE POLICY "Admins can delete deliveries" ON public.bounty_deliveries
FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

-- Admins can update deliveries (release)
CREATE POLICY "Admins can update deliveries" ON public.bounty_deliveries
FOR UPDATE TO authenticated
USING (is_admin(auth.uid()));

-- Create storage bucket for bounty deliveries (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('bounty-deliveries', 'bounty-deliveries', false);

-- Storage policies: only assigned modder can upload
CREATE POLICY "Modder can upload bounty delivery" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bounty-deliveries'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Only the uploader can read their own uploads (edge function handles secure download)
CREATE POLICY "Modder can read own bounty uploads" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'bounty-deliveries'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can manage all bounty delivery files
CREATE POLICY "Admins manage bounty deliveries storage" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'bounty-deliveries' AND is_admin(auth.uid())
);
