
ALTER TABLE public.purchases 
ADD COLUMN platform_commission numeric NOT NULL DEFAULT 0,
ADD COLUMN modder_earnings numeric NOT NULL DEFAULT 0,
ADD COLUMN commission_rate numeric NOT NULL DEFAULT 0.20;
