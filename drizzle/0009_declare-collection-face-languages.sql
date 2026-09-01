ALTER TABLE "collections" ADD COLUMN "front_language" text;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "back_language" text;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_front_language_length" CHECK ("collections"."front_language" is null or char_length("collections"."front_language") between 2 and 35);--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_back_language_length" CHECK ("collections"."back_language" is null or char_length("collections"."back_language") between 2 and 35);