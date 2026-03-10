ALTER TABLE public.profiles DROP COLUMN IF EXISTS mercadopago_access_token;
ALTER TABLE public.purchases DROP COLUMN IF EXISTS pix_qr_code;
ALTER TABLE public.purchases DROP COLUMN IF EXISTS pix_qr_code_base64;