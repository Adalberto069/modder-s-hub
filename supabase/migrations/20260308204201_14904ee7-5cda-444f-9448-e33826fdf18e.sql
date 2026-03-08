
-- Create purchases table
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create licenses table
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  license_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Purchases RLS
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all purchases" ON public.purchases FOR SELECT USING (is_admin(auth.uid()));

-- Licenses RLS
CREATE POLICY "Users can view own licenses" ON public.licenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own licenses" ON public.licenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all licenses" ON public.licenses FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can update licenses" ON public.licenses FOR UPDATE USING (is_admin(auth.uid()));

-- Function to generate license key
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
  j integer;
BEGIN
  FOR i IN 1..3 LOOP
    IF i > 1 THEN result := result || '-'; END IF;
    FOR j IN 1..4 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$;
