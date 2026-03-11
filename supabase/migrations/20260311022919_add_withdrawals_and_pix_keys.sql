-- Migration: add_withdrawals_and_pix_keys
-- Description: Adiciona colunas de Chave PIX nos profiles e cria a tabela de Saques (Withdrawals)

-- 1. Adicionar colunas de PIX na tabela de Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key_type text CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random'));

-- 2. Criar a tabela de Withdrawals (Saques)
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    modder_id uuid REFERENCES public.profiles(id) NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    pix_key text NOT NULL,
    pix_key_type text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at timestamp with time zone,
    admin_notes text
);

-- 3. Habilitar RLS e Politicas para Withdrawals
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Politica: Modders podem ver apenas os proprios saques
CREATE POLICY "Modders can view their own withdrawals"
    ON public.withdrawals
    FOR SELECT
    USING (auth.uid() = modder_id);

-- Politica: Modders podem criar seus proprios pedidos de saque
CREATE POLICY "Modders can insert their own withdrawals"
    ON public.withdrawals
    FOR INSERT
    WITH CHECK (auth.uid() = modder_id AND status = 'pending');

-- Politica: Admins podem ver todos os saques
CREATE POLICY "Admins can view all withdrawals"
    ON public.withdrawals
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    );

-- Politica: Admins podem atualizar todos os saques
CREATE POLICY "Admins can update all withdrawals"
    ON public.withdrawals
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    );
