import { z } from "zod";
import { gradeSchema } from "../domain/review.js";
import { maximumCardTextLength } from "./card.js";
import { uuidSchema } from "./common.js";
import { problemTypes } from "./problem.js";

export const tutorLimits = {
  messageCharacters: 500,
  conversationMessageCeiling: 16,
  conversationMessageCharacters: 4_000,
  /** Wave one Exercises hold one Card; this leaves headroom for a grouped Exercise (VOK-18). */
  exerciseCardCeiling: 8,
} as const;

export const tutorMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(tutorLimits.conversationMessageCharacters),
});

export const tutorExerciseCardSchema = z.object({
  cardId: uuidSchema,
  /** The Grade this Card resolved to; null for a flip Card, which sends no self-assigned outcome. */
  outcome: gradeSchema.nullable(),
});
export type TutorExerciseCard = z.infer<typeof tutorExerciseCardSchema>;

export const tutorInputSchema = z.object({
  message: z.string().min(1).max(tutorLimits.messageCharacters),
  messages: z.array(tutorMessageSchema).max(tutorLimits.conversationMessageCeiling),
  /** The Card the Tutor dialog is anchored to — always one of `exerciseCards`. */
  subjectCardId: uuidSchema,
  /** Every Card the resolved Exercise covers; always one Card until a grouped Exercise ships. */
  exerciseCards: z.array(tutorExerciseCardSchema).min(1).max(tutorLimits.exerciseCardCeiling),
  /** The option text the Learner chose, untrusted like Card content; null for a flip Card. */
  chosenOptionText: z.string().min(1).max(maximumCardTextLength).nullable(),
});
export type TutorInput = z.infer<typeof tutorInputSchema>;

export const tutorStreamEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("delta"), data: z.object({ text: z.string().min(1) }) }),
  z.object({ event: z.literal("done"), data: z.object({ truncated: z.boolean() }) }),
  z.object({
    event: z.literal("error"),
    data: z.object({ type: z.literal(problemTypes.tutorFailed) }),
  }),
]);
