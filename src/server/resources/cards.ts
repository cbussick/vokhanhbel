import { and, desc, eq, isNull } from "drizzle-orm";
import type { CreateCardInput, UpdateCardInput } from "../../contracts/card";
import { problemTypes } from "../../contracts/problem";
import { getDatabase } from "../database/client";
import { cards } from "../database/schema";
import { AppProblem } from "../http/problem";
import { mapCard } from "./cardMapper";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;

  return "cause" in error && isUniqueViolation(error.cause);
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
      .values({ front: input.front, normalizedFront: input.front, back: input.back })
      .returning();

    return mapCard(rows[0]!);
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AppProblem(
        409,
        problemTypes.cardFrontConflict,
        "Diese Vorderseite gibt es schon",
        undefined,
        [{ pointer: "/front", code: "not_unique" }],
      );
    throw error;
  }
}

export async function updateCard(cardId: string, input: UpdateCardInput) {
  const values: Partial<typeof cards.$inferInsert> = { updatedAt: new Date() };

  if (input.front !== undefined) {
    values.front = input.front;
    values.normalizedFront = input.front;
  }
  if (input.back !== undefined) values.back = input.back;
  try {
    const rows = await getDatabase()
      .update(cards)
      .set(values)
      .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
      .returning();

    if (!rows[0]) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");

    return mapCard(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AppProblem(
        409,
        problemTypes.cardFrontConflict,
        "Diese Vorderseite gibt es schon",
        undefined,
        [{ pointer: "/front", code: "not_unique" }],
      );
    throw error;
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  await getDatabase()
    .update(cards)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)));
}
