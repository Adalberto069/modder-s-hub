CREATE TABLE IF NOT EXISTS public.script_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL,
  script_title text,
  modder_id uuid,
  deleted_by uuid,
  deleted_by_admin boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.script_deletion_audit TO authenticated;
GRANT ALL ON public.script_deletion_audit TO service_role;

ALTER TABLE public.script_deletion_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view deletion audit"
ON public.script_deletion_audit FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_script_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.script_deletion_audit (script_id, script_title, modder_id, deleted_by, deleted_by_admin)
  VALUES (
    OLD.id,
    OLD.title,
    OLD.modder_id,
    auth.uid(),
    COALESCE(public.is_admin(auth.uid()), false)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_script_deletion ON public.scripts;
CREATE TRIGGER trg_log_script_deletion
BEFORE DELETE ON public.scripts
FOR EACH ROW EXECUTE FUNCTION public.log_script_deletion();