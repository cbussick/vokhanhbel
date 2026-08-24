import { z } from "zod";
import { boxSchema } from "../domain/review.js";
import { createNormalizedTextSchema, utcTimestampSchema, uuidSchema } from "./common.js";

export const maximumCardTextLength = 1_000;

export const audioMetadataSchema = z.object({
  id: uuidSchema,
  durationMs: z.number().int().positive().max(7_000),
  contentType: z.enum(["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"]),
  byteSize: z.number().int().positive().max(2_000_000),
});
export type AudioMetadata = z.infer<typeof audioMetadataSchema>;

export const cardFaceSchema = z.object({
  text: z.string().min(1).max(maximumCardTextLength).nullable(),
  audio: audioMetadataSchema.nullable(),
});
export type CardFace = z.infer<typeof cardFaceSchema>;

const nullableCardTextSchema = z.union([
  createNormalizedTextSchema(maximumCardTextLength),
  z.null(),
]);

export const createCardFaceInputSchema = z
  .object({ text: nullableCardTextSchema, audioId: uuidSchema.nullable() })
  .refine((face) => face.text !== null || face.audioId !== null, { message: "empty-face" });
export type CreateCardFaceInput = z.infer<typeof createCardFaceInputSchema>;

export const updateCardFaceInputSchema = z
  .object({ text: nullableCardTextSchema.optional(), audioId: uuidSchema.nullable().optional() })
  .refine((face) => face.text !== undefined || face.audioId !== undefined, {
    message: "empty-face-update",
  });
export type UpdateCardFaceInput = z.infer<typeof updateCardFaceInputSchema>;

const structuredCardSchema = z.object({
  id: uuidSchema,
  collectionId: uuidSchema,
  topicIds: z.array(uuidSchema),
  front: cardFaceSchema,
  back: cardFaceSchema,
  box: boxSchema,
  dueAt: utcTimestampSchema,
  lastReviewedAt: utcTimestampSchema.nullable(),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export const cardSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  // This preprocessor is the boundary parser itself, so the payload has no contract yet;
  // cardSchema imposes one below.
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- boundary parser
  const candidate = value as Record<string, unknown>;

  return {
    ...candidate,
    topicIds: Array.isArray(candidate.topicIds) ? candidate.topicIds : [],
    front:
      typeof candidate.front === "string"
        ? { text: candidate.front, audio: null }
        : candidate.front,
    back:
      typeof candidate.back === "string" ? { text: candidate.back, audio: null } : candidate.back,
  };
}, structuredCardSchema);

export type Card = z.infer<typeof cardSchema>;

export const createCardInputSchema = z.object({
  collectionId: uuidSchema,
  topicIds: z.array(uuidSchema).default([]),
  front: createCardFaceInputSchema,
  back: createCardFaceInputSchema,
});
export type CreateCardInput = z.input<typeof createCardInputSchema>;

export const updateCardInputSchema = z
  .object({
    collectionId: uuidSchema.optional(),
    topicIds: z.array(uuidSchema).optional(),
    front: updateCardFaceInputSchema.optional(),
    back: updateCardFaceInputSchema.optional(),
  })
  .refine(
    (value) =>
      value.collectionId !== undefined ||
      value.topicIds !== undefined ||
      value.front !== undefined ||
      value.back !== undefined,
    { message: "empty-update" },
  );
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;

export const cardListSchema = z.array(cardSchema);
