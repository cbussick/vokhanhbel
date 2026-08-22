import { z } from "zod";
import { audioMetadataSchema, cardSchema, type Card } from "../../contracts/card.js";
import { boxSchema } from "../../domain/review.js";

const audioRowSchema = audioMetadataSchema.extend({ deletedAt: z.date().nullable() }).nullable();

const cardRowSchema = z.object({
  id: z.uuid(),
  collectionId: z.uuid(),
  frontText: z.string().nullable(),
  backText: z.string().nullable(),
  box: boxSchema,
  dueAt: z.date(),
  lastReviewedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

const joinedCardRowSchema = z.object({
  card: cardRowSchema,
  frontAudio: audioRowSchema,
  backAudio: audioRowSchema,
});

export type CardRow = z.input<typeof joinedCardRowSchema>;

export function mapCard(value: unknown, topicIds: string[] = []): Card {
  const row = joinedCardRowSchema.parse(value);
  const frontAudio = row.frontAudio?.deletedAt ? null : row.frontAudio;
  const backAudio = row.backAudio?.deletedAt ? null : row.backAudio;

  return cardSchema.parse({
    id: row.card.id,
    collectionId: row.card.collectionId,
    topicIds,
    front: {
      text: row.card.frontText,
      audio: frontAudio
        ? {
            id: frontAudio.id,
            durationMs: frontAudio.durationMs,
            contentType: frontAudio.contentType,
            byteSize: frontAudio.byteSize,
          }
        : null,
    },
    back: {
      text: row.card.backText,
      audio: backAudio
        ? {
            id: backAudio.id,
            durationMs: backAudio.durationMs,
            contentType: backAudio.contentType,
            byteSize: backAudio.byteSize,
          }
        : null,
    },
    box: row.card.box,
    dueAt: row.card.dueAt.toISOString(),
    lastReviewedAt: row.card.lastReviewedAt?.toISOString() ?? null,
    createdAt: row.card.createdAt.toISOString(),
    updatedAt: row.card.updatedAt.toISOString(),
    deletedAt: row.card.deletedAt?.toISOString() ?? null,
  });
}
