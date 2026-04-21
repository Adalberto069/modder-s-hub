-- Auto-purge moderation messages read more than 30 days ago
CREATE OR REPLACE FUNCTION public.purge_old_read_moderation_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  WITH d AS (
    DELETE FROM public.moderation_messages
    WHERE is_read = true
      AND created_at < now() - interval '30 days'
    RETURNING id
  )
  SELECT count(*) INTO _deleted FROM d;
  RETURN _deleted;
END;
$$;

-- Allow admin to delete moderation_messages (needed if ever wanted via UI; SECURITY DEFINER above bypasses RLS for cron)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='moderation_messages' AND policyname='Admins can delete moderation messages'
  ) THEN
    CREATE POLICY "Admins can delete moderation messages"
      ON public.moderation_messages FOR DELETE
      TO authenticated
      USING (is_admin(auth.uid()));
  END IF;
END $$;

-- Schedule daily cron at 03:30 UTC
SELECT cron.unschedule('purge-old-moderation-messages')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-moderation-messages');

SELECT cron.schedule(
  'purge-old-moderation-messages',
  '30 3 * * *',
  $$ SELECT public.purge_old_read_moderation_messages(); $$
);