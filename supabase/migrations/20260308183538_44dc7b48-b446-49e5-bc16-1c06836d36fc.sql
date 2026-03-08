-- Function to auto-assign a badge if not already assigned
CREATE OR REPLACE FUNCTION public.auto_assign_badge(_user_id uuid, _badge_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _badge_id uuid;
BEGIN
  SELECT id INTO _badge_id FROM badge_definitions WHERE slug = _badge_slug;
  IF _badge_id IS NULL THEN RETURN; END IF;

  INSERT INTO user_badges (user_id, badge_id)
  VALUES (_user_id, _badge_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Trigger function: fires after script INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.check_script_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _script_count integer;
  _total_downloads integer;
  _max_rating numeric;
BEGIN
  -- Only check published scripts
  IF NEW.publish_status <> 'published' THEN RETURN NEW; END IF;

  -- Script Creator: first published script
  SELECT count(*) INTO _script_count
  FROM scripts WHERE modder_id = NEW.modder_id AND publish_status = 'published';

  IF _script_count >= 1 THEN
    PERFORM auto_assign_badge(NEW.modder_id, 'script-creator');
  END IF;

  -- 5 Scripts
  IF _script_count >= 5 THEN
    PERFORM auto_assign_badge(NEW.modder_id, 'five-scripts');
  END IF;

  -- 1000 Downloads (sum across all scripts)
  SELECT COALESCE(sum(download_count), 0) INTO _total_downloads
  FROM scripts WHERE modder_id = NEW.modder_id;

  IF _total_downloads >= 1000 THEN
    PERFORM auto_assign_badge(NEW.modder_id, '1000-downloads');
  END IF;

  -- Top Script (any script with average_rating >= 4.5 and at least 5 ratings)
  SELECT MAX(average_rating) INTO _max_rating
  FROM scripts WHERE modder_id = NEW.modder_id AND total_ratings >= 5;

  IF _max_rating >= 4.5 THEN
    PERFORM auto_assign_badge(NEW.modder_id, 'top-script');
  END IF;

  RETURN NEW;
END;
$$;

-- Add unique constraint to prevent duplicate badge assignments
ALTER TABLE public.user_badges
ADD CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_id);

-- Trigger on scripts table (insert and update)
CREATE TRIGGER trg_check_script_badges
AFTER INSERT OR UPDATE ON public.scripts
FOR EACH ROW
EXECUTE FUNCTION public.check_script_badges();
