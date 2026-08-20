CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "collections_name_length" CHECK (char_length("collections"."name") between 1 and 60),
	CONSTRAINT "collections_name_normalized" CHECK ("collections"."name" = normalize_card_text("collections"."name")),
	CONSTRAINT "collections_normalized_name_matches" CHECK ("collections"."normalized_name" = "collections"."name")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "collections_active_name_unique" ON "collections" USING btree (lower("normalized_name")) WHERE "collections"."deleted_at" is null;--> statement-breakpoint
INSERT INTO "collections" ("id", "name", "normalized_name") VALUES ('00000000-0000-4000-8000-000000000001', 'Vietnamesisch', 'Vietnamesisch');--> statement-breakpoint
DROP INDEX "cards_due_active_idx";--> statement-breakpoint
DROP INDEX "cards_active_front_unique";--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "collection_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "cards_collection_due_active_idx" ON "cards" USING btree ("collection_id","due_at") WHERE "cards"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "cards_active_front_unique" ON "cards" USING btree ("collection_id",lower("normalized_front")) WHERE "cards"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "reviews" DISABLE TRIGGER "reviews_prevent_update_or_delete";--> statement-breakpoint
UPDATE "reviews" AS r SET "result_card" = r."result_card" || jsonb_build_object('collectionId', c."collection_id"::text) FROM "cards" AS c WHERE c."id" = r."card_id";--> statement-breakpoint
ALTER TABLE "reviews" ENABLE TRIGGER "reviews_prevent_update_or_delete";
