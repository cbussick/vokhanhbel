import { z } from "zod";
import { collectionSchema, type Collection } from "../../contracts/collection.js";

const collectionRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string(),
  frontLanguage: z.string().nullable(),
  backLanguage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export function mapCollection(value: unknown): Collection {
  const row = collectionRowSchema.parse(value);

  return collectionSchema.parse({
    id: row.id,
    name: row.name,
    icon: row.icon,
    frontLanguage: row.frontLanguage,
    backLanguage: row.backLanguage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  });
}
