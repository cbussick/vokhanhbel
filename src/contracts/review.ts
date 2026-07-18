import { z } from "zod";
import { boxSchema, gradeSchema } from "../domain/review.js";
import { cardSchema } from "./card.js";
import { utcTimestampSchema, uuidSchema } from "./common.js";

export const reviewSubmissionInputSchema = z.object({
  id: uuidSchema,
  cardId: uuidSchema,
  grade: gradeSchema,
  reviewedAt: utcTimestampSchema,
});
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionInputSchema>;

export const reviewSchema = z.object({
  ...reviewSubmissionInputSchema.shape,
  pointsAwarded: z.union([z.literal(1), z.literal(5), z.literal(10)]),
  boxBefore: boxSchema,
  boxAfter: boxSchema,
  recordedAt: utcTimestampSchema,
});

export const reviewResultSchema = z.object({ review: reviewSchema, card: cardSchema });
export type ReviewResult = z.infer<typeof reviewResultSchema>;
