import { and, asc, eq, isNull } from "drizzle-orm";
import { problemTypes } from "../../contracts/problem.js";
import type { CreateTopicInput, TopicInput } from "../../contracts/topic.js";
import { getDatabase } from "../database/client.js";
import { isForeignKeyViolation, isUniqueViolation } from "../database/errors.js";
import { cardTopics, collections, topics } from "../database/schema.js";
import { AppProblem } from "../http/problem.js";
import { mapTopic } from "./topicMapper.js";

function throwNameConflict(): never {
  throw new AppProblem(
    409,
    problemTypes.topicNameConflict,
    "Dieses Thema gibt es schon",
    undefined,
    [{ pointer: "/name", code: "not_unique" }],
  );
}

export async function listTopics() {
  const rows = await getDatabase()
    .select()
    .from(topics)
    .where(isNull(topics.deletedAt))
    .orderBy(asc(topics.createdAt));

  return rows.map(mapTopic);
}

export async function createTopic(input: CreateTopicInput) {
  const [collection] = await getDatabase()
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, input.collectionId), isNull(collections.deletedAt)))
    .limit(1);

  if (!collection)
    throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");

  try {
    const rows = await getDatabase()
      .insert(topics)
      .values({
        collectionId: input.collectionId,
        name: input.name,
        normalizedName: input.name,
        icon: input.icon,
      })
      .returning();

    return mapTopic(rows[0]!);
  } catch (error) {
    if (isUniqueViolation(error)) throwNameConflict();
    if (isForeignKeyViolation(error))
      throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");
    throw error;
  }
}

export async function updateTopic(topicId: string, input: TopicInput) {
  try {
    const rows = await getDatabase()
      .update(topics)
      .set({
        name: input.name,
        normalizedName: input.name,
        icon: input.icon,
        updatedAt: new Date(),
      })
      .where(and(eq(topics.id, topicId), isNull(topics.deletedAt)))
      .returning();

    if (!rows[0]) throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

    return mapTopic(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) throwNameConflict();
    throw error;
  }
}

export async function deleteTopic(topicId: string): Promise<void> {
  const database = getDatabase();
  const rows = await database
    .update(topics)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(topics.id, topicId), isNull(topics.deletedAt)))
    .returning({ id: topics.id });

  if (!rows[0]) throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

  await database.delete(cardTopics).where(eq(cardTopics.topicId, topicId));
}
