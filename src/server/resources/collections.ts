import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { CollectionInput } from "../../contracts/collection.js";
import { problemTypes } from "../../contracts/problem.js";
import { getDatabase, getPool } from "../database/client.js";
import { isUniqueViolation } from "../database/errors.js";
import { collections } from "../database/schema.js";
import { AppProblem } from "../http/problem.js";
import { deleteAudioObject } from "./audio.js";
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
      .values({
        name: input.name,
        normalizedName: input.name,
        icon: input.icon,
        frontLanguage: input.frontLanguage ?? null,
        backLanguage: input.backLanguage ?? null,
      })
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
      .set({
        name: input.name,
        normalizedName: input.name,
        icon: input.icon,
        // Undefined, so an omitted language keeps the stored one; an explicit null clears it.
        frontLanguage: input.frontLanguage,
        backLanguage: input.backLanguage,
        updatedAt: new Date(),
      })
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
  const client = await getPool().connect();
  const obsoleteAudio: { id: string; objectKey: string }[] = [];

  try {
    await client.query("BEGIN");
    const selected = await client.query(
      "SELECT id FROM collections WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [collectionId],
    );

    if (!selected.rows[0])
      throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");

    const audio = await client.query(
      `SELECT audio_assets.id, audio_assets.object_key
       FROM audio_assets
       INNER JOIN cards ON audio_assets.claimed_card_id=cards.id
       WHERE cards.collection_id=$1 AND cards.deleted_at IS NULL
       FOR UPDATE OF audio_assets`,
      [collectionId],
    );
    obsoleteAudio.push(
      ...z
        .array(z.object({ id: z.uuid(), object_key: z.string() }))
        .parse(audio.rows)
        .map((row) => ({ id: row.id, objectKey: row.object_key })),
    );

    await client.query(
      `UPDATE audio_assets SET deleted_at=now(), claimed_card_id=NULL, claimed_face=NULL
       WHERE claimed_card_id IN (
         SELECT id FROM cards WHERE collection_id=$1 AND deleted_at IS NULL
       )`,
      [collectionId],
    );
    await client.query(
      `DELETE FROM card_topics WHERE card_id IN (
         SELECT id FROM cards WHERE collection_id=$1 AND deleted_at IS NULL
       )`,
      [collectionId],
    );
    await client.query(
      `UPDATE cards
       SET deleted_at=now(), updated_at=now(), front_audio_id=NULL, back_audio_id=NULL
       WHERE collection_id=$1 AND deleted_at IS NULL`,
      [collectionId],
    );
    await client.query(
      `UPDATE topics SET deleted_at=now(), updated_at=now()
       WHERE collection_id=$1 AND deleted_at IS NULL`,
      [collectionId],
    );
    await client.query("UPDATE collections SET deleted_at=now(), updated_at=now() WHERE id=$1", [
      collectionId,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await Promise.all(obsoleteAudio.map((audio) => deleteAudioObject(audio, "collection-delete")));
}
