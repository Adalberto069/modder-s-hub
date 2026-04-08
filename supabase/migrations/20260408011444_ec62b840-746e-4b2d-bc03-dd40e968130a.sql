-- FK from bounties.requester_id to profiles.user_id
ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_requester_id_fkey
  FOREIGN KEY (requester_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- FK from bounties.assigned_modder_id to profiles.user_id  
ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_assigned_modder_id_fkey
  FOREIGN KEY (assigned_modder_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- FK from bounty_applications.modder_id to profiles.user_id
ALTER TABLE public.bounty_applications
  ADD CONSTRAINT bounty_applications_modder_id_fkey
  FOREIGN KEY (modder_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Trigger: auto-notify requester on new application
CREATE OR REPLACE FUNCTION public.notify_on_bounty_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bounty RECORD;
  _modder_name text;
BEGIN
  SELECT id, title, requester_id INTO _bounty FROM bounties WHERE id = NEW.bounty_id;
  IF _bounty IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username) INTO _modder_name
  FROM profiles WHERE user_id = NEW.modder_id LIMIT 1;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    _bounty.requester_id,
    '👾 Nova candidatura!',
    COALESCE(_modder_name, 'Um modder') || ' se candidatou à sua encomenda "' || _bounty.title || '"',
    'info',
    '/bounties/' || _bounty.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_bounty_application_notify
  AFTER INSERT ON public.bounty_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_bounty_application();

-- Trigger: notify modder when application accepted
CREATE OR REPLACE FUNCTION public.notify_on_bounty_application_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bounty RECORD;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT id, title INTO _bounty FROM bounties WHERE id = NEW.bounty_id;
    IF _bounty IS NULL THEN RETURN NEW; END IF;

    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.modder_id,
      '🎯 Candidatura aceita!',
      'Sua candidatura para "' || _bounty.title || '" foi aceita!',
      'success',
      '/bounties/' || _bounty.id
    );
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    SELECT id, title INTO _bounty FROM bounties WHERE id = NEW.bounty_id;
    IF _bounty IS NULL THEN RETURN NEW; END IF;

    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.modder_id,
      '❌ Candidatura recusada',
      'Sua candidatura para "' || _bounty.title || '" foi recusada.',
      'warning',
      '/bounties/' || _bounty.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_bounty_application_status_change
  AFTER UPDATE ON public.bounty_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_bounty_application_accepted();