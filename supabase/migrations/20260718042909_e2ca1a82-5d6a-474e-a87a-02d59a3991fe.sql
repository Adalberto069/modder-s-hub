-- Escrow columns on script_purchases
ALTER TABLE public.script_purchases
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS escrow_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_dispute_reason text,
  ADD COLUMN IF NOT EXISTS escrow_disputed_at timestamptz;

UPDATE public.script_purchases
  SET escrow_status = 'released', escrow_released_at = COALESCE(escrow_released_at, created_at)
  WHERE status = 'completed' AND escrow_status = 'held' AND created_at < now() - interval '1 day';

-- Escrow columns on bounty_purchases
ALTER TABLE public.bounty_purchases
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS escrow_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_dispute_reason text,
  ADD COLUMN IF NOT EXISTS escrow_disputed_at timestamptz;

UPDATE public.bounty_purchases
  SET escrow_status = 'released', escrow_released_at = COALESCE(escrow_released_at, created_at)
  WHERE status = 'completed' AND escrow_status = 'held' AND created_at < now() - interval '1 day';

-- Purchase disputes table
CREATE TABLE IF NOT EXISTS public.purchase_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  purchase_type text NOT NULL CHECK (purchase_type IN ('script','bounty')),
  opener_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modder_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved_buyer','resolved_seller','cancelled')),
  admin_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_disputes_purchase_idx ON public.purchase_disputes(purchase_id, purchase_type);
CREATE INDEX IF NOT EXISTS purchase_disputes_opener_idx ON public.purchase_disputes(opener_id);
CREATE INDEX IF NOT EXISTS purchase_disputes_status_idx ON public.purchase_disputes(status);

GRANT SELECT, INSERT, UPDATE ON public.purchase_disputes TO authenticated;
GRANT ALL ON public.purchase_disputes TO service_role;

ALTER TABLE public.purchase_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Opener can view own disputes"
  ON public.purchase_disputes FOR SELECT TO authenticated
  USING (auth.uid() = opener_id);

CREATE POLICY "Modder can view disputes against them"
  ON public.purchase_disputes FOR SELECT TO authenticated
  USING (auth.uid() = modder_id);

CREATE POLICY "Admins can view all disputes"
  ON public.purchase_disputes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can open disputes"
  ON public.purchase_disputes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = opener_id);

CREATE POLICY "Admins update disputes"
  ON public.purchase_disputes FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_purchase_disputes_updated
  BEFORE UPDATE ON public.purchase_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-release cron function (called by edge function)
CREATE OR REPLACE FUNCTION public.release_expired_escrows()
RETURNS TABLE(released_scripts int, released_bounties int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s int := 0;
  _b int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.script_purchases sp
       SET escrow_status = 'released',
           escrow_released_at = now()
     WHERE sp.escrow_status = 'held'
       AND sp.escrow_release_at IS NOT NULL
       AND sp.escrow_release_at < now()
       AND NOT EXISTS (
         SELECT 1 FROM public.purchase_disputes d
         WHERE d.purchase_id = sp.id AND d.purchase_type = 'script' AND d.status = 'open'
       )
    RETURNING sp.id, sp.modder_id
  )
  SELECT count(*) INTO _s FROM upd;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT DISTINCT sp.modder_id, '💰 Pagamento liberado', 'Uma venda saiu da custódia e o valor está disponível.', 'success', '/dashboard?tab=finance'
    FROM public.script_purchases sp
   WHERE sp.escrow_status = 'released'
     AND sp.escrow_released_at > now() - interval '5 minutes';

  WITH upd AS (
    UPDATE public.bounty_purchases bp
       SET escrow_status = 'released',
           escrow_released_at = now()
     WHERE bp.escrow_status = 'held'
       AND bp.escrow_release_at IS NOT NULL
       AND bp.escrow_release_at < now()
       AND NOT EXISTS (
         SELECT 1 FROM public.purchase_disputes d
         WHERE d.purchase_id = bp.id AND d.purchase_type = 'bounty' AND d.status = 'open'
       )
    RETURNING bp.id, bp.modder_id
  )
  SELECT count(*) INTO _b FROM upd;

  RETURN QUERY SELECT _s, _b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_expired_escrows() TO service_role;