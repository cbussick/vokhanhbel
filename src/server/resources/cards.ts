import { and, desc, eq, isNull } from "drizzle-orm";
import type { CreateCardInput, UpdateCardInput } from "../../contracts/card.js";
import { problemTypes } from "../../contracts/problem.js";
import { getDatabase } from "../database/client.js";
import { isForeignKeyViolation, isUniqueViolation } from "../database/errors.js";
import { cards } from "../database/schema.js";
import { AppProblem } from "../http/problem.js";
import { mapCard } from "./cardMapper.js";

function throwCardWriteProblem(error: unknown): never {
  if (isUniqueViolation(error))
    throw new AppProblem(
      409,
      problemTypes.cardFrontConflict,
      "Diese Vorderseite gibt es schon",
      undefined,
      [{ pointer: "/front", code: "not_unique" }],
    );
  if (isForeignKeyViolation(error))
    throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");
  throw error;
}

export async function listCards() {
  const rows = await getDatabase()
    .select()
    .from(cards)
    .where(isNull(cards.deletedAt))
    .orderBy(desc(cards.createdAt));

  return rows.map(mapCard);
}

export async function getCard(cardId: string) {
  const rows = await getDatabase()
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
    .limit(1);

  if (!rows[0]) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");

  return mapCard(rows[0]);
}

export async function createCard(input: CreateCardInput) {
  try {
    const rows = await getDatabase()
      .insert(cards)
      .values({
        collectionId: input.collectionId,
        front: input.front,
        normalizedFront: input.front,
        back: input.back,
      })
      .returning();

    return mapCard(rows[0]!);
  } catch (error) {
    throwCardWriteProblem(error);
  }
}

export async function updateCard(cardId: string, input: UpdateCardInput) {
  const values: Partial<typeof cards.$inferInsert> = { updatedAt: new Date() };

  if (input.front !== undefined) {
    values.front = input.front;
    values.normalizedFront = input.front;
  }
  if (input.back !== undefined) values.back = input.back;
  if (input.collectionId !== undefined) values.collectionId = input.collectionId;
  try {
    const rows = await getDatabase()
      .update(cards)
      .set(values)
      .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
      .returning();

    if (!rows[0]) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");

    return mapCard(rows[0]);
  } catch (error) {
    throwCardWriteProblem(error);
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  await getDatabase()
    .update(cards)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)));
}
