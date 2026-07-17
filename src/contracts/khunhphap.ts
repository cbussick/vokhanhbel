import { z } from "zod";
import { problemTypes } from "./problem";

export const khunhphapLimits = {
  messageCharacters: 500,
  conversationMessages: 8,
  conversationMessageCharacters: 4_000,
} as const;

export const khunhphapMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(khunhphapLimits.conversationMessageCharacters),
});

export const khunhphapInputSchema = z.object({
  message: z.string().min(1).max(khunhphapLimits.messageCharacters),
  messages: z.array(khunhphapMessageSchema).max(khunhphapLimits.conversationMessages),
});
export type KhunhphapInput = z.infer<typeof khunhphapInputSchema>;

export const khunhphapStreamEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("delta"), data: z.object({ text: z.string().min(1) }) }),
  z.object({ event: z.literal("done"), data: z.object({ truncated: z.boolean() }) }),
  z.object({
    event: z.literal("error"),
    data: z.object({ type: z.literal(problemTypes.khunhphapFailed) }),
  }),
]);
