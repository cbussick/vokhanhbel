import { z } from "zod";
import { boxSchema } from "../domain/review.js";
import { createNormalizedTextSchema, utcTimestampSchema, uuidSchema } from "./common.js";

export const cardFrontSchema = createNormalizedTextSchema(200);
export const cardBackSchema = createNormalizedTextSchema(1_000);

export const cardSchema = z.object({
  id: uuidSchema,
  collectionId: uuidSchema,
  front: z.string().min(1).max(200),
  back: z.string().min(1).max(1_000),
  box: boxSchema,
  dueAt: utcTimestampSchema,
  lastReviewedAt: utcTimestampSchema.nullable(),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export type Card = z.infer<typeof cardSchema>;

export const createCardInputSchema = z.object({
  collectionId: uuidSchema,
  front: cardFrontSchema,
  back: cardBackSchema,
});
export type CreateCardInput = z.infer<typeof createCardInputSchema>;

export const updateCardInputSchema = z
  .object({
    collectionId: uuidSchema.optional(),
    front: cardFrontSchema.optional(),
    back: cardBackSchema.optional(),
  })
  .refine(
    (value) =>
      value.collectionId !== undefined || value.front !== undefined || value.back !== undefined,
    { message: "empty-update" },
  );
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;

export const cardListSchema = z.array(cardSchema);
