CREATE TABLE "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_hash" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION normalize_card_text(value text) RETURNS text AS $$
DECLARE
	normalized text := normalize(replace(replace(value, E'\r\n', E'\n'), E'\r', E'\n'), NFC);
	character text;
	result text;
	horizontal_whitespace_pattern text := '[' || chr(9) || chr(32) || chr(160) || chr(5760)
		|| chr(8192) || '-' || chr(8202) || chr(8232) || chr(8233) || chr(8239)
		|| chr(8287) || chr(12288) || chr(65279) || ']+';
BEGIN
	FOR character IN SELECT regexp_split_to_table(normalized, '') LOOP
		IF ascii(character) BETWEEN 0 AND 8
			OR ascii(character) IN (11, 12)
			OR ascii(character) BETWEEN 14 AND 31
			OR ascii(character) BETWEEN 127 AND 159 THEN
			RAISE EXCEPTION 'Card text contains a disallowed control character';
		END IF;
	END LOOP;
	SELECT string_agg(trim(regexp_replace(line, horizontal_whitespace_pattern, ' ', 'g')), E'\n' ORDER BY ordinal)
	INTO result
	FROM unnest(string_to_array(normalized, E'\n')) WITH ORDINALITY AS lines(line, ordinal);
	RETURN trim(regexp_replace(result, E'^\\n+|\\n+$', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"front" text NOT NULL,
	"normalized_front" text NOT NULL,
	"back" text NOT NULL,
	"box" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cards_front_length" CHECK (char_length("cards"."front") between 1 and 200),
	CONSTRAINT "cards_back_length" CHECK (char_length("cards"."back") between 1 and 1000),
	CONSTRAINT "cards_box_range" CHECK ("cards"."box" between 0 and 5),
	CONSTRAINT "cards_front_normalized" CHECK ("cards"."front" = normalize_card_text("cards"."front")),
	CONSTRAINT "cards_back_normalized" CHECK ("cards"."back" = normalize_card_text("cards"."back")),
	CONSTRAINT "cards_normalized_front_matches" CHECK ("cards"."normalized_front" = "cards"."front")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"grade" text NOT NULL,
	"points_awarded" integer NOT NULL,
	"box_before" integer NOT NULL,
	"box_after" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result_card" jsonb NOT NULL,
	CONSTRAINT "reviews_grade_value" CHECK ("reviews"."grade" in ('forgot', 'almost', 'knew_it')),
	CONSTRAINT "reviews_points_value" CHECK ("reviews"."points_awarded" in (1, 5, 10)),
	CONSTRAINT "reviews_box_before_range" CHECK ("reviews"."box_before" between 0 and 5),
	CONSTRAINT "reviews_box_after_range" CHECK ("reviews"."box_after" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"identifier_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "ai_usage_session_time_idx" ON "ai_usage" USING btree ("session_hash","used_at");--> statement-breakpoint
CREATE INDEX "ai_usage_time_idx" ON "ai_usage" USING btree ("used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_active_front_unique" ON "cards" USING btree (lower("normalized_front")) WHERE "cards"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "cards_due_active_idx" ON "cards" USING btree ("due_at") WHERE "cards"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "login_attempts_ip_time_idx" ON "login_attempts" USING btree ("ip_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "reviews_reviewed_at_idx" ON "reviews" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE FUNCTION prevent_card_delete() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'Cards must be soft deleted';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER cards_prevent_delete BEFORE DELETE ON "cards"
FOR EACH ROW EXECUTE FUNCTION prevent_card_delete();--> statement-breakpoint
CREATE FUNCTION prevent_review_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'Reviews are append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER reviews_prevent_update_or_delete BEFORE UPDATE OR DELETE ON "reviews"
FOR EACH ROW EXECUTE FUNCTION prevent_review_mutation();
