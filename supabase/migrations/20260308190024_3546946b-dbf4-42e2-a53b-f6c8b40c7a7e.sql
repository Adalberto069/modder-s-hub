
-- Moderation messages between moderators and script authors
CREATE TABLE public.moderation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON public.moderation_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Authenticated can insert messages"
  ON public.moderation_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own received messages"
  ON public.moderation_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);

-- Moderation audit log
CREATE TABLE public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL,
  action text NOT NULL,
  details text,
  previous_status text,
  new_status text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation logs"
  ON public.moderation_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert moderation logs"
  ON public.moderation_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Add security_status column to scripts for display
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS security_status text NOT NULL DEFAULT 'pending';

-- Indexes
CREATE INDEX idx_moderation_messages_script ON public.moderation_messages(script_id);
CREATE INDEX idx_moderation_messages_recipient ON public.moderation_messages(recipient_id);
CREATE INDEX idx_moderation_logs_script ON public.moderation_logs(script_id);
CREATE INDEX idx_scripts_security_status ON public.scripts(security_status);
