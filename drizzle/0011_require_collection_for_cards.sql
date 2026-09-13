ALTER TABLE "cards" ALTER COLUMN "collection_id" DROP DEFAULT;--> statement-breakpoint
DELETE FROM "collections"
WHERE "id" = '00000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1
    FROM "cards"
    WHERE "cards"."collection_id" = "collections"."id"
  );