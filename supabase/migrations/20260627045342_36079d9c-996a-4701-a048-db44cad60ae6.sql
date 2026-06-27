
-- =====================================================
-- RENOMES (ALTER TABLE preserva FKs, RLS, dados, triggers)
-- =====================================================
ALTER TABLE public.reviews    RENAME TO script_reviews;
ALTER TABLE public.favorites  RENAME TO script_favorites;
ALTER TABLE public.purchases  RENAME TO script_purchases;
ALTER TABLE public.licenses   RENAME TO script_licenses;

-- Renomear índices criados na Fase 1 para refletir novos nomes
ALTER INDEX IF EXISTS idx_reviews_script_id      RENAME TO idx_script_reviews_script_id;
ALTER INDEX IF EXISTS idx_favorites_user_id      RENAME TO idx_script_favorites_user_id;
ALTER INDEX IF EXISTS idx_purchases_script_id    RENAME TO idx_script_purchases_script_id;
ALTER INDEX IF EXISTS idx_purchases_user_id      RENAME TO idx_script_purchases_user_id;
ALTER INDEX IF EXISTS idx_licenses_user_id       RENAME TO idx_script_licenses_user_id;
ALTER INDEX IF EXISTS idx_licenses_script_id     RENAME TO idx_script_licenses_script_id;
ALTER INDEX IF EXISTS idx_licenses_purchase_id   RENAME TO idx_script_licenses_purchase_id;

-- =====================================================
-- Atualizar funções que referenciam os nomes antigos
-- =====================================================
CREATE OR REPLACE FUNCTION public.script_has_purchases(_script_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.script_purchases WHERE script_id = _script_id)
$$;

CREATE OR REPLACE FUNCTION public.get_script_file_url(_script_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.file_url FROM public.scripts s
  WHERE s.id = _script_id
  AND (
    s.is_paid = false
    OR s.modder_id = auth.uid()
    OR is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.script_purchases p WHERE p.script_id = _script_id AND p.user_id = auth.uid() AND p.status = 'completed')
    OR EXISTS (SELECT 1 FROM public.script_licenses l WHERE l.script_id = _script_id AND l.user_id = auth.uid() AND l.status = 'active')
  )
$$;

-- =====================================================
-- Atualizar comentários de domínio
-- =====================================================
COMMENT ON TABLE public.script_reviews   IS '[SCRIPTS] Avaliações (1-5 estrelas) e comentários em scripts';
COMMENT ON TABLE public.script_favorites IS '[SCRIPTS] Scripts favoritados por usuários';
COMMENT ON TABLE public.script_purchases IS '[LICENSES] Histórico de compras de scripts via Mercado Pago';
COMMENT ON TABLE public.script_licenses  IS '[LICENSES] Licenças ativas (7d, 30d ou permanente) geradas após compra';

-- =====================================================
-- FASE 2: CHECK constraints de integridade (não destrutivos)
-- =====================================================
ALTER TABLE public.scripts
  DROP CONSTRAINT IF EXISTS scripts_price_nonneg,
  ADD  CONSTRAINT scripts_price_nonneg CHECK (price IS NULL OR price >= 0);

ALTER TABLE public.script_reviews
  DROP CONSTRAINT IF EXISTS script_reviews_rating_range,
  ADD  CONSTRAINT script_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE public.bounties
  DROP CONSTRAINT IF EXISTS bounties_reward_positive,
  ADD  CONSTRAINT bounties_reward_positive CHECK (reward_amount IS NULL OR reward_amount > 0);

ALTER TABLE public.script_purchases
  DROP CONSTRAINT IF EXISTS script_purchases_amount_nonneg,
  ADD  CONSTRAINT script_purchases_amount_nonneg CHECK (amount IS NULL OR amount >= 0);
