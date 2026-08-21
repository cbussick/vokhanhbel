CREATE OR REPLACE FUNCTION synchronize_legacy_card_faces() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW.front_text IS NULL AND NEW.front IS NOT NULL THEN
			NEW.front_text := NEW.front;
		ELSE
			NEW.front := NEW.front_text;
		END IF;
		IF NEW.back_text IS NULL AND NEW.back IS NOT NULL THEN
			NEW.back_text := NEW.back;
		ELSE
			NEW.back := NEW.back_text;
		END IF;
	ELSE
		IF NEW.front IS DISTINCT FROM OLD.front AND NEW.front_text IS NOT DISTINCT FROM OLD.front_text THEN
			NEW.front_text := NEW.front;
		ELSIF NEW.front_text IS DISTINCT FROM OLD.front_text THEN
			NEW.front := NEW.front_text;
		END IF;
		IF NEW.back IS DISTINCT FROM OLD.back AND NEW.back_text IS NOT DISTINCT FROM OLD.back_text THEN
			NEW.back_text := NEW.back;
		ELSIF NEW.back_text IS DISTINCT FROM OLD.back_text THEN
			NEW.back := NEW.back_text;
		END IF;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
