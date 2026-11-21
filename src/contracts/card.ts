import { z } from "zod";
import { boxSchema } from "../domain/review.js";
import { createNormalizedTextSchema, utcTimestampSchema, uuidSchema } from "./common.js";

export const maximumCardTextLength = 1000;

/** What any clip on a Card face has to fit in, however it was produced. */
export const maximumAudioDurationMs = 7000;
export const maximumAudioBytes = 2_000_000;

export const audioMetadataSchema = z.object({
  id: uuidSchema,
  durationMs: z.number().int().positive().max(maximumAudioDurationMs),
  contentType: z.enum(["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"]),
  byteSize: z.number().int().positive().max(maximumAudioBytes),
  /** How this Clip was made. Absent means its pre-provenance origin is unknown. */
  source: z.enum(["recorded", "generated"]).nullable().optional(),
  /**
   * The exact text a speech provider was given, and null for a clip the Learner recorded herself,
   * whose contents nothing here knows. It travels with the clip so the Card form can say what the
   * clip says, whether it arrived from the server or was just generated. The default keeps a Card
   * snapshot a Review stored before this field existed readable.
   */
  synthesizedText: z.string().nullable().default(null),
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

export const updateCardFaceInputSchema = z
  .object({ text: nullableCardTextSchema.optional(), audioId: uuidSchema.nullable().optional() })
  .refine((face) => face.text !== undefined || face.audioId !== undefined, {
    message: "empty-face-update",
  });

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
  if (!value || typeof value !== "object") {
    return value;
  }
  const topicIds = "topicIds" in value ? value.topicIds : undefined;
  const front = "front" in value ? value.front : undefined;
  const back = "back" in value ? value.back : undefined;

  return {
    ...value,
    topicIds: Array.isArray(topicIds) ? topicIds : [],
    front: typeof front === "string" ? { text: front, audio: null } : front,
    back: typeof back === "string" ? { text: back, audio: null } : back,
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
