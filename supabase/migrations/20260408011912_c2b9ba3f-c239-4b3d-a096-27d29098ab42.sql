-- Create bounty_messages table
CREATE TABLE public.bounty_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bounty_messages ENABLE ROW LEVEL SECURITY;

-- Only requester or accepted modder can view messages
CREATE POLICY "Participants can view bounty messages"
  ON public.bounty_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_messages.bounty_id
        AND (b.requester_id = auth.uid() OR b.assigned_modder_id = auth.uid())
    )
    OR public.is_admin(auth.uid())
  );

-- Only requester or accepted modder can send messages (bounty must be in_progress)
CREATE POLICY "Participants can send bounty messages"
  ON public.bounty_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_messages.bounty_id
        AND b.status = 'in_progress'
        AND (b.requester_id = auth.uid() OR b.assigned_modder_id = auth.uid())
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bounty_messages;

-- Trigger: notify recipient on new message
CREATE OR REPLACE FUNCTION public.notify_on_bounty_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bounty RECORD;
  _sender_name text;
  _recipient_id uuid;
BEGIN
  SELECT id, title, requester_id, assigned_modder_id INTO _bounty
  FROM bounties WHERE id = NEW.bounty_id;
  IF _bounty IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username) INTO _sender_name
  FROM profiles WHERE user_id = NEW.sender_id LIMIT 1;

  -- Send notification to the other participant
  IF NEW.sender_id = _bounty.requester_id THEN
    _recipient_id := _bounty.assigned_modder_id;
  ELSE
    _recipient_id := _bounty.requester_id;
  END IF;

  IF _recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      _recipient_id,
      '💬 Nova mensagem',
      COALESCE(_sender_name, 'Alguém') || ' enviou uma mensagem na encomenda "' || _bounty.title || '"',
      'info',
      '/bounties/' || _bounty.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_bounty_message_notify
  AFTER INSERT ON public.bounty_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_bounty_message();