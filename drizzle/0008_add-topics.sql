CREATE TABLE "card_topics" (
	"card_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "card_topics_card_id_topic_id_pk" PRIMARY KEY("card_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"icon" text DEFAULT 'shapes' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "topics_name_length" CHECK (char_length("topics"."name") between 1 and 60),
	CONSTRAINT "topics_icon_length" CHECK (char_length("topics"."icon") between 1 and 40),
	CONSTRAINT "topics_name_normalized" CHECK ("topics"."name" = normalize_card_text("topics"."name")),
	CONSTRAINT "topics_normalized_name_matches" CHECK ("topics"."normalized_name" = "topics"."name")
);
--> statement-breakpoint
ALTER TABLE "card_topics" ADD CONSTRAINT "card_topics_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "card_topics" ADD CONSTRAINT "card_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "card_topics_topic_idx" ON "card_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_active_name_unique" ON "topics" USING btree ("collection_id",lower("normalized_name")) WHERE "topics"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "topics_collection_active_idx" ON "topics" USING btree ("collection_id") WHERE "topics"."deleted_at" is null;