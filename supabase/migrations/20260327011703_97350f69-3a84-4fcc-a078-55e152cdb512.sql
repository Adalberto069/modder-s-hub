-- Fix search_path for block_lua_code_in_scripts
CREATE OR REPLACE FUNCTION public.block_lua_code_in_scripts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.lua_code := NULL;
  RETURN NEW;
END;
$$;