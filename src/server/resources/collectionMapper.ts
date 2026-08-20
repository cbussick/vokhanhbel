import { z } from "zod";
import { collectionSchema, type Collection } from "../../contracts/collection.js";

const collectionRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export function mapCollection(value: unknown): Collection {
  const row = collectionRowSchema.parse(value);

  return collectionSchema.parse({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  });
}
