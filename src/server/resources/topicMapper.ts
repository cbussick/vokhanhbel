import { z } from "zod";
import { topicSchema, type Topic } from "../../contracts/topic.js";

const topicRowSchema = z.object({
  id: z.uuid(),
  collectionId: z.uuid(),
  name: z.string(),
  icon: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export function mapTopic(value: unknown): Topic {
  const row = topicRowSchema.parse(value);

  return topicSchema.parse({
    id: row.id,
    collectionId: row.collectionId,
    name: row.name,
    icon: row.icon,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  });
}
