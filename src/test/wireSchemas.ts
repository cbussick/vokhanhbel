import { z } from "zod";
import { collectionIconSchema, collectionLanguageSchema } from "../contracts/collection";
import { reviewSubmissionInputSchema } from "../contracts/review";
import { tutorInputSchema, tutorMessageSchema, tutorExerciseCardSchema } from "../contracts/tutor";

// Interception tests inspect the bytes the client sent, not normalized application data.
// Preserve unexpected keys, whitespace and omitted fields rather than repairing evidence.
const faceWireSchema = z.looseObject({ text: z.string().nullable(), audioId: z.string().nullable() });
export const cardInputWireSchema = z.looseObject({
  collectionId: z.string(),
  topicIds: z.array(z.string()).optional(),
  front: faceWireSchema,
  back: faceWireSchema,
});
export const collectionInputWireSchema = z.looseObject({
  name: z.string(),
  icon: collectionIconSchema,
  frontLanguage: collectionLanguageSchema.nullable().optional(),
  backLanguage: collectionLanguageSchema.nullable().optional(),
});
export const loginWireSchema = z.looseObject({ password: z.string() });
export const pronunciationWireSchema = z.looseObject({ text: z.string(), language: collectionLanguageSchema });
export const nameWireSchema = z.looseObject({ name: z.string() });
export const reviewWireSchema = z.looseObject(reviewSubmissionInputSchema.shape);
export const tutorWireSchema = z.looseObject({
  ...tutorInputSchema.shape,
  messages: z.array(z.looseObject(tutorMessageSchema.shape)),
  exerciseCards: z.array(z.looseObject(tutorExerciseCardSchema.shape)),
});
