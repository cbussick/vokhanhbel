import { z } from "zod";
import { createNormalizedTextSchema, utcTimestampSchema, uuidSchema } from "./common.js";

const collectionNameSchema = createNormalizedTextSchema(60);

export const collectionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(60),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export type Collection = z.infer<typeof collectionSchema>;

export const collectionInputSchema = z.object({ name: collectionNameSchema });
export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const collectionListSchema = z.array(collectionSchema);
