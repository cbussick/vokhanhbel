import { z } from "zod";
import { createNormalizedTextSchema, utcTimestampSchema, uuidSchema } from "./common.js";

const topicNameSchema = createNormalizedTextSchema(60);

export const defaultTopicIcon = "shapes";
/**
 * Append-only: a shipped key must keep working, because a migration reaches production before the
 * deploy that knows the key. Adding one is a code change; the column itself stays unconstrained.
 */
export const topicIconKeys = [defaultTopicIcon, "animal", "food", "travel", "people"] as const;
export const topicIconSchema = z.enum(topicIconKeys);
export type TopicIconKey = z.infer<typeof topicIconSchema>;

export const topicSchema = z.object({
  id: uuidSchema,
  collectionId: uuidSchema,
  name: z.string().min(1).max(60),
  icon: topicIconSchema.catch(defaultTopicIcon),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export type Topic = z.infer<typeof topicSchema>;

export const topicInputSchema = z.object({
  name: topicNameSchema,
  icon: topicIconSchema,
});
export type TopicInput = z.infer<typeof topicInputSchema>;

export const createTopicInputSchema = topicInputSchema.extend({
  collectionId: uuidSchema,
});
export type CreateTopicInput = z.infer<typeof createTopicInputSchema>;

export const topicListSchema = z.array(topicSchema);
