import { z } from "zod";
import {
  audioMetadataSchema,
  cardSchema,
  type AudioMetadata,
  type Card,
} from "../../contracts/card.js";
import { boxSchema } from "../../domain/review.js";

/**
 * A Card's audio as a join returns it: its metadata plus the deletion the join cannot filter. The
 * deletion is coerced because the two readers deliver it differently — the query builder hands back
 * a `Date`, while the review path's raw SQL builds the row as JSON and so hands back a string.
 */
export const audioRowSchema = audioMetadataSchema
  .extend({ deletedAt: z.coerce.date().nullable() })
  .nullable();

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

/**
 * A joined audio row is its metadata plus the deletion the join cannot filter, so dropping that one
 * column is the whole conversion. Reading it back through the metadata schema drops it without
 * naming every other field, so a new audio field does not have to be copied out here as well.
 */
function audioOnCard(row: z.infer<typeof audioRowSchema>): AudioMetadata | null {
  if (!row || row.deletedAt) return null;

  return audioMetadataSchema.parse(row);
}

export function mapCard(value: unknown, topicIds: string[]): Card {
  const row = joinedCardRowSchema.parse(value);

  return cardSchema.parse({
    id: row.card.id,
    collectionId: row.card.collectionId,
    topicIds,
    front: { text: row.card.frontText, audio: audioOnCard(row.frontAudio) },
    back: { text: row.card.backText, audio: audioOnCard(row.backAudio) },
    box: row.card.box,
    dueAt: row.card.dueAt.toISOString(),
    lastReviewedAt: row.card.lastReviewedAt?.toISOString() ?? null,
    createdAt: row.card.createdAt.toISOString(),
    updatedAt: row.card.updatedAt.toISOString(),
    deletedAt: row.card.deletedAt?.toISOString() ?? null,
  });
}
