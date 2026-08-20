import { z } from "zod";
import { problemTypes } from "./problem.js";

export const tutorLimits = {
  messageCharacters: 500,
  conversationMessages: 8,
  conversationMessageCharacters: 4_000,
} as const;

export const tutorMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(tutorLimits.conversationMessageCharacters),
});

export const tutorInputSchema = z.object({
  message: z.string().min(1).max(tutorLimits.messageCharacters),
  messages: z.array(tutorMessageSchema).max(tutorLimits.conversationMessages),
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
