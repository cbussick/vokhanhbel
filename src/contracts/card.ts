import { z } from "zod";
import { containsRejectedControlCharacter, normalizeCardText } from "../domain/cardText";
import { boxSchema } from "../domain/review";
import { utcTimestampSchema, uuidSchema } from "./common";

function createCardTextSchema(maximumLength: number) {
  return z
    .string()
    .superRefine((value, context) => {
      if (containsRejectedControlCharacter(value)) {
        context.addIssue({ code: "custom", message: "control-character" });
      }
    })
    .transform(normalizeCardText)
    .pipe(z.string().min(1).max(maximumLength));
}

export const cardFrontSchema = createCardTextSchema(200);
export const cardBackSchema = createCardTextSchema(1_000);

export const cardSchema = z.object({
  id: uuidSchema,
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
  front: cardFrontSchema,
  back: cardBackSchema,
});
export type CreateCardInput = z.infer<typeof createCardInputSchema>;

export const updateCardInputSchema = z
  .object({ front: cardFrontSchema.optional(), back: cardBackSchema.optional() })
  .refine((value) => value.front !== undefined || value.back !== undefined, {
    message: "empty-update",
  });
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;

export const cardListSchema = z.array(cardSchema);
