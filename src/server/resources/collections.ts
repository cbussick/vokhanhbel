import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import type { CollectionInput } from "../../contracts/collection.js";
import { problemTypes } from "../../contracts/problem.js";
import { getDatabase } from "../database/client.js";
import { isUniqueViolation } from "../database/errors.js";
import { cards, collections } from "../database/schema.js";
import { AppProblem } from "../http/problem.js";
import { mapCollection } from "./collectionMapper.js";

function throwNameConflict(): never {
  throw new AppProblem(
    409,
    problemTypes.collectionNameConflict,
    "Diese Sammlung gibt es schon",
    undefined,
    [{ pointer: "/name", code: "not_unique" }],
  );
}

export async function listCollections() {
  const rows = await getDatabase()
    .select()
    .from(collections)
    .where(isNull(collections.deletedAt))
    .orderBy(asc(collections.createdAt));

  return rows.map(mapCollection);
}

export async function createCollection(input: CollectionInput) {
  try {
    const rows = await getDatabase()
      .insert(collections)
      .values({ name: input.name, normalizedName: input.name })
      .returning();

    return mapCollection(rows[0]!);
  } catch (error) {
    if (isUniqueViolation(error)) throwNameConflict();
    throw error;
  }
}

export async function updateCollection(collectionId: string, input: CollectionInput) {
  try {
    const rows = await getDatabase()
      .update(collections)
      .set({ name: input.name, normalizedName: input.name, updatedAt: new Date() })
      .where(and(eq(collections.id, collectionId), isNull(collections.deletedAt)))
      .returning();

    if (!rows[0])
      throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");

    return mapCollection(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) throwNameConflict();
    throw error;
  }
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const database = getDatabase();
  const [held] = await database
    .select({ value: count() })
    .from(cards)
    .where(and(eq(cards.collectionId, collectionId), isNull(cards.deletedAt)));

  if ((held?.value ?? 0) > 0)
    throw new AppProblem(409, problemTypes.collectionNotEmpty, "Verschiebe zuerst die Karten");

  const [remaining] = await database
    .select({ value: count() })
    .from(collections)
    .where(and(ne(collections.id, collectionId), isNull(collections.deletedAt)));

  if ((remaining?.value ?? 0) === 0)
    throw new AppProblem(409, problemTypes.lastCollection, "Die letzte Sammlung bleibt bestehen");

  const rows = await database
    .update(collections)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(collections.id, collectionId), isNull(collections.deletedAt)))
    .returning({ id: collections.id });

  if (!rows[0])
    throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");
}
