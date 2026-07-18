import { z } from "zod";
import { cardSchema, type Card } from "../../contracts/card.js";
import { boxSchema } from "../../domain/review.js";

const cardRowSchema = z.object({
  id: z.uuid(),
  front: z.string(),
  back: z.string(),
  box: boxSchema,
  dueAt: z.date(),
  lastReviewedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export function mapCard(value: unknown): Card {
  const row = cardRowSchema.parse(value);

  return cardSchema.parse({
    id: row.id,
    front: row.front,
    back: row.back,
    box: row.box,
    dueAt: row.dueAt.toISOString(),
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  });
}
