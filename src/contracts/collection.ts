import { z } from "zod";
import { createNormalizedTextSchema, utcTimestampSchema, uuidSchema } from "./common.js";

export const collectionNameSchema = createNormalizedTextSchema(60);

export const collectionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(60),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export type Collection = z.infer<typeof collectionSchema>;

export const createCollectionInputSchema = z.object({ name: collectionNameSchema });
export type CreateCollectionInput = z.infer<typeof createCollectionInputSchema>;

export const updateCollectionInputSchema = z.object({ name: collectionNameSchema });
export type UpdateCollectionInput = z.infer<typeof updateCollectionInputSchema>;

export const collectionListSchema = z.array(collectionSchema);
