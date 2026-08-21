ALTER TABLE "cards" DROP CONSTRAINT "cards_front_present";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_back_present";--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_front_present" CHECK ("cards"."deleted_at" is not null or "cards"."front_text" is not null or "cards"."front_audio_id" is not null);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_back_present" CHECK ("cards"."deleted_at" is not null or "cards"."back_text" is not null or "cards"."back_audio_id" is not null);