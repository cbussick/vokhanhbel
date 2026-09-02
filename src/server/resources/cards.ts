import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PoolClient } from "pg";
import { z } from "zod";
import type { CreateCardInput, UpdateCardInput } from "../../contracts/card.js";
import { problemTypes } from "../../contracts/problem.js";
import { getDatabase, getPool } from "../database/client.js";
import { isForeignKeyViolation, isUniqueViolation } from "../database/errors.js";
import { audioAssets, cardTopics, cards, topics } from "../database/schema.js";
import { AppProblem } from "../http/problem.js";
import { deleteAudioObject } from "./audio.js";
import { mapCard } from "./cardMapper.js";

interface LegacyCreateCardInput {
  collectionId: string;
  front: string;
  back: string;
}

const lockedCardSchema = z.object({
  collection_id: z.uuid(),
  front_text: z.string().nullable(),
  front_audio_id: z.uuid().nullable(),
  back_text: z.string().nullable(),
  back_audio_id: z.uuid().nullable(),
});

const claimedAudioSchema = z.object({ id: z.uuid(), object_key: z.string() });

function throwCardWriteProblem(error: unknown): never {
  if (error instanceof AppProblem) throw error;
  if (isUniqueViolation(error))
    throw new AppProblem(
      409,
      problemTypes.cardFrontConflict,
      "Diese Vorderseite gibt es schon",
      undefined,
      [{ pointer: "/front/text", code: "not_unique" }],
    );
  if (isForeignKeyViolation(error))
    throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");
  throw error;
}

function structuredInput(input: CreateCardInput | LegacyCreateCardInput): CreateCardInput {
  // The two input shapes differ only in `front`: a string means the legacy shape, an object means
  // the structured one. That makes this check a discriminator for the union.
  if (typeof input.front !== "string") {
    // SAFETY: a non-string `front` means the value is already the structured shape.
    return input as CreateCardInput;
  }

  // SAFETY: reaching this line means `front` is a string, so `input` is the legacy shape.
  const legacy = input as LegacyCreateCardInput;

  return {
    collectionId: legacy.collectionId,
    topicIds: [],
    front: { text: legacy.front, audioId: null },
    back: { text: legacy.back, audioId: null },
  };
}

const frontAudio = alias(audioAssets, "front_audio");
const backAudio = alias(audioAssets, "back_audio");

function selectCards() {
  return getDatabase()
    .select({
      card: cards,
      frontAudio: {
        id: frontAudio.id,
        durationMs: frontAudio.durationMs,
        contentType: frontAudio.contentType,
        byteSize: frontAudio.byteSize,
        synthesizedText: frontAudio.synthesizedText,
        deletedAt: frontAudio.deletedAt,
      },
      backAudio: {
        id: backAudio.id,
        durationMs: backAudio.durationMs,
        contentType: backAudio.contentType,
        byteSize: backAudio.byteSize,
        synthesizedText: backAudio.synthesizedText,
        deletedAt: backAudio.deletedAt,
      },
    })
    .from(cards)
    .leftJoin(frontAudio, eq(cards.frontAudioId, frontAudio.id))
    .leftJoin(backAudio, eq(cards.backAudioId, backAudio.id));
}

async function topicIdsByCard(cardIds: string[]): Promise<Map<string, string[]>> {
  const memberships = new Map<string, string[]>();

  if (cardIds.length === 0) return memberships;

  const rows = await getDatabase()
    .select({ cardId: cardTopics.cardId, topicId: cardTopics.topicId })
    .from(cardTopics)
    .innerJoin(topics, eq(cardTopics.topicId, topics.id))
    .where(and(inArray(cardTopics.cardId, cardIds), isNull(topics.deletedAt)));

  for (const row of rows) {
    const list = memberships.get(row.cardId) ?? [];
    list.push(row.topicId);
    memberships.set(row.cardId, list);
  }

  return memberships;
}

async function uniqueTopicIdsForCollection(
  client: PoolClient,
  collectionId: string,
  topicIds: string[],
): Promise<string[]> {
  const unique = [...new Set(topicIds)];

  if (unique.length === 0) return unique;

  const result = await client.query<{ id: string }>(
    `SELECT id FROM topics
     WHERE id = ANY($1::uuid[]) AND collection_id=$2 AND deleted_at IS NULL`,
    [unique, collectionId],
  );

  if (result.rows.length !== unique.length)
    throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

  return unique;
}

async function replaceCardTopics(
  client: PoolClient,
  cardId: string,
  topicIds: string[],
): Promise<void> {
  await client.query("DELETE FROM card_topics WHERE card_id=$1", [cardId]);

  if (topicIds.length === 0) return;

  await client.query("INSERT INTO card_topics (card_id, topic_id) SELECT $1, unnest($2::uuid[])", [
    cardId,
    topicIds,
  ]);
}

export async function listCards() {
  const rows = await selectCards().where(isNull(cards.deletedAt)).orderBy(desc(cards.createdAt));
  const memberships = await topicIdsByCard(rows.map((row) => row.card.id));

  return rows.map((row) => mapCard(row, memberships.get(row.card.id) ?? []));
}

export async function getCard(cardId: string) {
  const rows = await selectCards()
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
    .limit(1);

  if (!rows[0]) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");
  const memberships = await topicIdsByCard([cardId]);

  return mapCard(rows[0], memberships.get(cardId) ?? []);
}

async function lockStagedAudio(
  client: PoolClient,
  audioId: string | null,
  sessionHash: string | undefined,
): Promise<void> {
  if (!audioId) return;
  if (!sessionHash)
    throw new AppProblem(409, problemTypes.audioNotOwned, "Audio gehört nicht zu dieser Sitzung");
  const result = await client.query(
    `SELECT id FROM audio_assets
     WHERE id=$1 AND owner_session_hash=$2 AND claimed_card_id IS NULL
       AND deleted_at IS NULL AND staged_until > now()
     FOR UPDATE`,
    [audioId, sessionHash],
  );

  if (!result.rows[0])
    throw new AppProblem(409, problemTypes.audioNotOwned, "Audio gehört nicht zu dieser Sitzung");
}

async function claimAudio(
  client: PoolClient,
  audioId: string | null,
  cardId: string,
  face: "front" | "back",
): Promise<void> {
  if (!audioId) return;
  await client.query("UPDATE audio_assets SET claimed_card_id=$1, claimed_face=$2 WHERE id=$3", [
    cardId,
    face,
    audioId,
  ]);
}

export async function createCard(
  inputValue: CreateCardInput | LegacyCreateCardInput,
  sessionHash?: string,
) {
  const input = structuredInput(inputValue);

  if (input.front.audioId && input.front.audioId === input.back.audioId)
    throw new AppProblem(
      422,
      problemTypes.invalidRequest,
      "Jede Kartenseite braucht eigenes Audio",
    );
  const client = await getPool().connect();
  const cardId = crypto.randomUUID();

  try {
    await client.query("BEGIN");
    await lockStagedAudio(client, input.front.audioId, sessionHash);
    await lockStagedAudio(client, input.back.audioId, sessionHash);
    const topicIds = await uniqueTopicIdsForCollection(
      client,
      input.collectionId,
      input.topicIds ?? [],
    );
    await client.query(
      `INSERT INTO cards
       (id, collection_id, front_text, normalized_front, front_audio_id, back_text, back_audio_id)
       VALUES ($1,$2,$3,$3,$4,$5,$6)`,
      [
        cardId,
        input.collectionId,
        input.front.text,
        input.front.audioId,
        input.back.text,
        input.back.audioId,
      ],
    );
    await replaceCardTopics(client, cardId, topicIds);
    await claimAudio(client, input.front.audioId, cardId, "front");
    await claimAudio(client, input.back.audioId, cardId, "back");
    await client.query("COMMIT");

    return getCard(cardId);
  } catch (error) {
    await client.query("ROLLBACK");
    throwCardWriteProblem(error);
  } finally {
    client.release();
  }
}

export async function updateCard(
  cardId: string,
  input: UpdateCardInput,
  sessionHash?: string,
  requestId?: string,
) {
  const client = await getPool().connect();
  const obsolete: { id: string; objectKey: string }[] = [];

  try {
    await client.query("BEGIN");
    const selected = await client.query(
      `SELECT collection_id, front_text, front_audio_id, back_text, back_audio_id
       FROM cards WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [cardId],
    );
    const current = selected.rows[0] ? lockedCardSchema.parse(selected.rows[0]) : undefined;

    if (!current) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");
    const collectionId = input.collectionId ?? current.collection_id;
    const frontText = input.front?.text === undefined ? current.front_text : input.front.text;
    const backText = input.back?.text === undefined ? current.back_text : input.back.text;
    const frontAudioId =
      input.front?.audioId === undefined ? current.front_audio_id : input.front.audioId;
    const backAudioId =
      input.back?.audioId === undefined ? current.back_audio_id : input.back.audioId;

    if (!frontText && !frontAudioId)
      throw new AppProblem(422, problemTypes.invalidRequest, "Vorderseite darf nicht leer sein");
    if (!backText && !backAudioId)
      throw new AppProblem(422, problemTypes.invalidRequest, "Rückseite darf nicht leer sein");
    if (frontAudioId && frontAudioId === backAudioId)
      throw new AppProblem(
        422,
        problemTypes.invalidRequest,
        "Jede Kartenseite braucht eigenes Audio",
      );

    if (frontAudioId !== current.front_audio_id)
      await lockStagedAudio(client, frontAudioId, sessionHash);
    if (backAudioId !== current.back_audio_id)
      await lockStagedAudio(client, backAudioId, sessionHash);
    await client.query(
      `UPDATE cards SET collection_id=$1, front_text=$2, normalized_front=$2,
       front_audio_id=$3, back_text=$4, back_audio_id=$5, updated_at=now() WHERE id=$6`,
      [collectionId, frontText, frontAudioId, backText, backAudioId, cardId],
    );
    if (input.topicIds !== undefined)
      await replaceCardTopics(
        client,
        cardId,
        await uniqueTopicIdsForCollection(client, collectionId, input.topicIds),
      );
    else if (collectionId !== current.collection_id) await replaceCardTopics(client, cardId, []);
    if (frontAudioId !== current.front_audio_id)
      await claimAudio(client, frontAudioId, cardId, "front");
    if (backAudioId !== current.back_audio_id)
      await claimAudio(client, backAudioId, cardId, "back");

    for (const oldAudioId of [current.front_audio_id, current.back_audio_id]) {
      if (!oldAudioId || oldAudioId === frontAudioId || oldAudioId === backAudioId) continue;
      const released = await client.query(
        `UPDATE audio_assets SET deleted_at=now(), claimed_card_id=NULL, claimed_face=NULL
         WHERE id=$1 RETURNING id, object_key`,
        [oldAudioId],
      );

      if (released.rows[0]) {
        const audio = claimedAudioSchema.parse(released.rows[0]);
        obsolete.push({ id: audio.id, objectKey: audio.object_key });
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throwCardWriteProblem(error);
  } finally {
    client.release();
  }

  await Promise.all(obsolete.map((audio) => deleteAudioObject(audio, "card-update", requestId)));

  return getCard(cardId);
}

export async function deleteCard(cardId: string, requestId?: string): Promise<void> {
  const client = await getPool().connect();
  const obsolete: { id: string; objectKey: string }[] = [];

  try {
    await client.query("BEGIN");
    const selected = await client.query(
      "SELECT front_audio_id, back_audio_id FROM cards WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [cardId],
    );

    const selectedCard = z
      .object({ front_audio_id: z.uuid().nullable(), back_audio_id: z.uuid().nullable() })
      .safeParse(selected.rows[0]);

    if (!selectedCard.success) {
      await client.query("COMMIT");

      return;
    }
    await client.query(
      `UPDATE cards SET deleted_at=now(), updated_at=now(), front_audio_id=NULL, back_audio_id=NULL
       WHERE id=$1`,
      [cardId],
    );
    await client.query("DELETE FROM card_topics WHERE card_id=$1", [cardId]);

    for (const audioId of [selectedCard.data.front_audio_id, selectedCard.data.back_audio_id]) {
      if (!audioId) continue;
      const released = await client.query(
        `UPDATE audio_assets SET deleted_at=now(), claimed_card_id=NULL, claimed_face=NULL
         WHERE id=$1 RETURNING id, object_key`,
        [audioId],
      );

      if (released.rows[0]) {
        const audio = claimedAudioSchema.parse(released.rows[0]);
        obsolete.push({ id: audio.id, objectKey: audio.object_key });
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await Promise.all(obsolete.map((audio) => deleteAudioObject(audio, "card-delete", requestId)));
}
