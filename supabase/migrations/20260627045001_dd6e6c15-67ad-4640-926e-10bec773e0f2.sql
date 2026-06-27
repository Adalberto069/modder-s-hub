
-- =====================================================
-- FASE 1: Índices em FKs sem índice
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_category_id ON public.scripts(category_id);
CREATE INDEX IF NOT EXISTS idx_scripts_modder_id ON public.scripts(modder_id);
CREATE INDEX IF NOT EXISTS idx_scripts_related_tutorial_id ON public.scripts(related_tutorial_id);
CREATE INDEX IF NOT EXISTS idx_reviews_script_id ON public.reviews(script_id);
CREATE INDEX IF NOT EXISTS idx_script_images_script_id ON public.script_images(script_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post_id ON public.forum_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_reply_likes_reply_id ON public.forum_reply_likes(reply_id);
CREATE INDEX IF NOT EXISTS idx_tools_tutorial_id ON public.tools(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_script_passwords_script_id ON public.script_passwords(script_id);
CREATE INDEX IF NOT EXISTS idx_script_access_script_id ON public.script_access(script_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_comments_tutorial_id ON public.tutorial_comments(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_comments_user_id ON public.tutorial_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_ratings_tutorial_id ON public.tutorial_ratings(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_script_analyses_script_id ON public.script_analyses(script_id);
CREATE INDEX IF NOT EXISTS idx_moderation_messages_script_id ON public.moderation_messages(script_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_script_id ON public.moderation_logs(script_id);
CREATE INDEX IF NOT EXISTS idx_purchases_script_id ON public.purchases(script_id);
CREATE INDEX IF NOT EXISTS idx_licenses_purchase_id ON public.licenses(purchase_id);
CREATE INDEX IF NOT EXISTS idx_licenses_script_id ON public.licenses(script_id);
CREATE INDEX IF NOT EXISTS idx_bounties_assigned_modder_id ON public.bounties(assigned_modder_id);
CREATE INDEX IF NOT EXISTS idx_bounties_category_id ON public.bounties(category_id);
CREATE INDEX IF NOT EXISTS idx_bounties_requester_id ON public.bounties(requester_id);
CREATE INDEX IF NOT EXISTS idx_bounty_applications_bounty_id ON public.bounty_applications(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_messages_bounty_id ON public.bounty_messages(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_messages_sender_id ON public.bounty_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_bounty_purchases_bounty_id ON public.bounty_purchases(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_deliveries_bounty_id ON public.bounty_deliveries(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_test_logs_bounty_id ON public.bounty_test_logs(bounty_id);

-- Índices em colunas frequentemente filtradas
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON public.licenses(user_id);

-- =====================================================
-- FASE 1: Triggers updated_at faltantes
-- =====================================================
DROP TRIGGER IF EXISTS update_bounty_purchases_updated_at ON public.bounty_purchases;
CREATE TRIGGER update_bounty_purchases_updated_at
  BEFORE UPDATE ON public.bounty_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_modder_mp_accounts_updated_at ON public.modder_mp_accounts;
CREATE TRIGGER update_modder_mp_accounts_updated_at
  BEFORE UPDATE ON public.modder_mp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_script_passwords_updated_at ON public.script_passwords;
CREATE TRIGGER update_script_passwords_updated_at
  BEFORE UPDATE ON public.script_passwords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FASE 1: Comentários de domínio (visíveis no dashboard)
-- =====================================================

-- AUTH / USERS
COMMENT ON TABLE public.profiles IS '[AUTH] Perfis públicos de usuários (display_name, avatar, bio, reputação)';
COMMENT ON TABLE public.user_roles IS '[AUTH] Patentes: user, modder, admin (separadas para evitar privilege escalation)';
COMMENT ON TABLE public.user_badges IS '[AUTH] Badges conquistadas por usuário';
COMMENT ON TABLE public.badge_definitions IS '[AUTH] Catálogo de badges disponíveis';

-- SCRIPTS
COMMENT ON TABLE public.scripts IS '[SCRIPTS] Scripts publicados no marketplace (metadados públicos)';
COMMENT ON TABLE public.script_access IS '[SCRIPTS] Controle de acesso/distribuição de scripts pagos';
COMMENT ON TABLE public.script_analyses IS '[SCRIPTS] Análises de segurança por IA (Gemini)';
COMMENT ON TABLE public.script_images IS '[SCRIPTS] Screenshots/imagens dos scripts';
COMMENT ON TABLE public.script_passwords IS '[SCRIPTS] Senhas opcionais para proteger scripts (bcrypt)';
COMMENT ON TABLE public.script_test_logs IS '[SCRIPTS] Logs de Test Drive (3min) de scripts do marketplace';
COMMENT ON TABLE public.categories IS '[SCRIPTS] Categorias de jogos/scripts';
COMMENT ON TABLE public.favorites IS '[SCRIPTS] Scripts favoritados por usuários';
COMMENT ON TABLE public.reviews IS '[SCRIPTS] Avaliações (1-5 estrelas) e comentários em scripts';

-- LICENSES & PURCHASES
COMMENT ON TABLE public.licenses IS '[LICENSES] Licenças ativas (7d, 30d ou permanente) geradas após compra';
COMMENT ON TABLE public.purchases IS '[LICENSES] Histórico de compras de scripts via Mercado Pago';

-- BOUNTY
COMMENT ON TABLE public.bounties IS '[BOUNTY] Encomendas/solicitações de scripts customizados';
COMMENT ON TABLE public.bounty_applications IS '[BOUNTY] Candidaturas de modders a encomendas';
COMMENT ON TABLE public.bounty_deliveries IS '[BOUNTY] Arquivos entregues pelo modder (em escrow até pagamento)';
COMMENT ON TABLE public.bounty_messages IS '[BOUNTY] Chat entre solicitante e modder na encomenda';
COMMENT ON TABLE public.bounty_purchases IS '[BOUNTY] Pagamentos das encomendas via Mercado Pago';
COMMENT ON TABLE public.bounty_test_logs IS '[BOUNTY] Logs de teste de entregas de bounty';

-- FORUM
COMMENT ON TABLE public.forum_posts IS '[FORUM] Tópicos do fórum';
COMMENT ON TABLE public.forum_replies IS '[FORUM] Respostas em tópicos';
COMMENT ON TABLE public.forum_reply_likes IS '[FORUM] Curtidas em respostas';

-- TUTORIALS
COMMENT ON TABLE public.tutorials IS '[TUTORIALS] Tutoriais publicados (blocos estruturados)';
COMMENT ON TABLE public.tutorial_comments IS '[TUTORIALS] Comentários em tutoriais';
COMMENT ON TABLE public.tutorial_ratings IS '[TUTORIALS] Avaliações de tutoriais';

-- PAYMENTS
COMMENT ON TABLE public.modder_mp_accounts IS '[PAYMENTS] Contas Mercado Pago conectadas via OAuth (split 80/20)';

-- MODERATION
COMMENT ON TABLE public.moderation_logs IS '[MODERATION] Histórico de ações de moderação em scripts';
COMMENT ON TABLE public.moderation_messages IS '[MODERATION] Mensagens da moderação para modders';
COMMENT ON TABLE public.reports IS '[MODERATION] Denúncias de conteúdo';
COMMENT ON TABLE public.audit_runs IS '[MODERATION] Auditorias automáticas de compras suspeitas';

-- PLATFORM
COMMENT ON TABLE public.notifications IS '[PLATFORM] Notificações por usuário (realtime + polling)';
COMMENT ON TABLE public.tools IS '[PLATFORM] Catálogo de ferramentas/utilitários (Game Guardian, etc)';
