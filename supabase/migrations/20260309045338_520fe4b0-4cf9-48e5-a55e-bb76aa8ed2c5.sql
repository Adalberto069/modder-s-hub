-- Add mercadopago_access_token to profiles for modder split payouts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mercadopago_access_token text;

-- Add payment tracking fields to purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'pix';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS pix_qr_code text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS pix_qr_code_base64 text;