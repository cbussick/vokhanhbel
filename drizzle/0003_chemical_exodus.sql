CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TABLE "audio_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" text NOT NULL,
	"owner_session_hash" text NOT NULL,
	"content_type" text NOT NULL,
	"codec" text NOT NULL,
	"byte_size" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"checksum" text NOT NULL,
	"staged_until" timestamp with time zone NOT NULL,
	"claimed_card_id" uuid,
	"claimed_face" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "audio_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "audio_assets_byte_size" CHECK ("audio_assets"."byte_size" between 1 and 2000000),
	CONSTRAINT "audio_assets_duration" CHECK ("audio_assets"."duration_ms" between 1 and 7000),
	CONSTRAINT "audio_assets_claim_shape" CHECK (("audio_assets"."claimed_card_id" is null and "audio_assets"."claimed_face" is null) or ("audio_assets"."claimed_card_id" is not null and "audio_assets"."claimed_face" in ('front', 'back')))
);
--> statement-breakpoint
CREATE TABLE "audio_cleanup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audio_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"reason" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "front_text" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "back_text" text;--> statement-breakpoint
UPDATE "cards" SET "front_text"="front", "back_text"="back";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_front_length";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_back_length";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_front_normalized";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_back_normalized";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_normalized_front_matches";--> statement-breakpoint
DROP INDEX "cards_active_front_unique";--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "normalized_front" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "front" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "back" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "front_audio_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "back_audio_id" uuid;--> statement-breakpoint
CREATE FUNCTION synchronize_legacy_card_faces() RETURNS trigger AS $$
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
	NEW.normalized_front := NEW.front_text;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER cards_synchronize_legacy_faces BEFORE INSERT OR UPDATE ON "cards"
FOR EACH ROW EXECUTE FUNCTION synchronize_legacy_card_faces();--> statement-breakpoint
CREATE UNIQUE INDEX "audio_assets_claimed_face_unique" ON "audio_assets" USING btree ("claimed_card_id","claimed_face") WHERE "audio_assets"."claimed_card_id" is not null and "audio_assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "audio_assets_staged_expiry_idx" ON "audio_assets" USING btree ("staged_until") WHERE "audio_assets"."claimed_card_id" is null and "audio_assets"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "audio_cleanup_jobs_pending_audio_unique" ON "audio_cleanup_jobs" USING btree ("audio_id") WHERE "audio_cleanup_jobs"."completed_at" is null;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_front_audio_id_audio_assets_id_fk" FOREIGN KEY ("front_audio_id") REFERENCES "public"."audio_assets"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_back_audio_id_audio_assets_id_fk" FOREIGN KEY ("back_audio_id") REFERENCES "public"."audio_assets"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "cards_active_front_unique" ON "cards" USING btree ("collection_id",digest(lower("normalized_front"), 'sha256')) WHERE "cards"."deleted_at" is null and "cards"."normalized_front" is not null;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_front_present" CHECK ("cards"."deleted_at" is not null or "cards"."front_text" is not null or "cards"."front_audio_id" is not null);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_back_present" CHECK ("cards"."deleted_at" is not null or "cards"."back_text" is not null or "cards"."back_audio_id" is not null);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_front_length" CHECK ("cards"."front_text" is null or char_length("cards"."front_text") between 1 and 1000);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_back_length" CHECK ("cards"."back_text" is null or char_length("cards"."back_text") between 1 and 1000);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_front_normalized" CHECK ("cards"."front_text" is null or "cards"."front_text" = normalize_card_text("cards"."front_text"));--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_back_normalized" CHECK ("cards"."back_text" is null or "cards"."back_text" = normalize_card_text("cards"."back_text"));--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_normalized_front_matches" CHECK ("cards"."normalized_front" is not distinct from "cards"."front_text");--> statement-breakpoint
ALTER TABLE "reviews" DISABLE TRIGGER "reviews_prevent_update_or_delete";--> statement-breakpoint
UPDATE "reviews" SET "result_card" = jsonb_set(
	jsonb_set("result_card" - 'front' - 'back', '{front}', jsonb_build_object('text', "result_card"->>'front', 'audio', null)),
	'{back}', jsonb_build_object('text', "result_card"->>'back', 'audio', null)
);--> statement-breakpoint
ALTER TABLE "reviews" ENABLE TRIGGER "reviews_prevent_update_or_delete";
