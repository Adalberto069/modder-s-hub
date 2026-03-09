-- Function to notify modder on purchase
CREATE OR REPLACE FUNCTION public.notify_on_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _script RECORD;
  _buyer_name text;
BEGIN
  SELECT id, title, modder_id, price INTO _script FROM scripts WHERE id = NEW.script_id;
  IF _script IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username) INTO _buyer_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    _script.modder_id,
    '💰 Nova compra!',
    COALESCE(_buyer_name, 'Alguém') || ' comprou seu script "' || _script.title || '" por R$ ' || COALESCE(_script.price, 0),
    'success',
    '/script/' || _script.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_purchase
AFTER INSERT ON purchases
FOR EACH ROW
EXECUTE FUNCTION notify_on_purchase();

-- Function to notify modder on new review
CREATE OR REPLACE FUNCTION public.notify_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _script RECORD;
  _reviewer_name text;
BEGIN
  SELECT id, title, modder_id INTO _script FROM scripts WHERE id = NEW.script_id;
  IF _script IS NULL THEN RETURN NEW; END IF;
  IF _script.modder_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username) INTO _reviewer_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    _script.modder_id,
    '⭐ Nova avaliação',
    COALESCE(_reviewer_name, 'Alguém') || ' avaliou seu script "' || _script.title || '" com ' || NEW.rating || ' estrela(s)',
    'info',
    '/script/' || _script.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_review
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION notify_on_review();