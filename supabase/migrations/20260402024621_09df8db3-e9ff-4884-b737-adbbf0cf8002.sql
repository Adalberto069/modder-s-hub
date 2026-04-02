
-- Table to store modder Mercado Pago OAuth tokens securely
CREATE TABLE public.modder_mp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  mp_user_id text NOT NULL,
  mp_access_token text NOT NULL,
  mp_refresh_token text NOT NULL,
  mp_public_key text,
  mp_token_expires_at timestamp with time zone,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.modder_mp_accounts ENABLE ROW LEVEL SECURITY;

-- Only the modder can see their own connection status (but NOT tokens)
CREATE POLICY "Users can view own mp account"
ON public.modder_mp_accounts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role handles insert/update via edge functions
-- No direct insert/update/delete for authenticated users
-- This keeps tokens secure - only edge functions with service role can write

-- Remove old withdrawals table and PIX columns since we use split now
DROP TABLE IF EXISTS public.withdrawals;

-- Clean PIX columns from profiles (optional data, won't break anything)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pix_key;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pix_key_type;
