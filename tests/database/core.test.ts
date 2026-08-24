import { afterEach, describe, expect, it, vi } from "vitest";
import { createWavFixture } from "../../src/server/audio/audioFixture.test-helper.js";
import {
  FailingAudioObjectStore,
  InMemoryAudioObjectStore,
  setAudioObjectStoreForTests,
} from "../../src/server/audio/audioObjectStore.js";
import { encodePassword } from "../../src/server/auth/password.js";
import { resetServerEnvironmentForTests } from "../../src/server/config/environment.js";
import { getPool } from "../../src/server/database/client.js";
import { defaultCollectionId } from "../../src/server/database/schema.js";
import { retryAudioCleanup, stageAudio } from "../../src/server/resources/audio.js";
import { createCard, deleteCard, listCards, updateCard } from "../../src/server/resources/cards.js";
import {
  createCollection,
  deleteCollection,
  listCollections,
} from "../../src/server/resources/collections.js";
import { recordReview } from "../../src/server/resources/reviews.js";
import { login } from "../../src/server/resources/sessions.js";
import { getStats } from "../../src/server/resources/stats.js";
import { createTopic, deleteTopic, listTopics } from "../../src/server/resources/topics.js";
import { consumeTutorAllowance, createTutorStream } from "../../src/server/resources/tutor.js";

const inDefaultCollection = { collectionId: defaultCollectionId };

afterEach(() => setAudioObjectStoreForTests(undefined));

describe("PostgreSQL application behavior", () => {
  it("enforces active normalized-front uniqueness and releases it after soft deletion", async () => {
    const card = await createCard({
      ...inDefaultCollection,
      front: "Take care",
      back: "Pass auf",
    });
    await expect(
      createCard({ ...inDefaultCollection, front: "take care", back: "Mach es gut" }),
    ).rejects.toMatchObject({ status: 409 });
    await deleteCard(card.id);
    await expect(
      createCard({ ...inDefaultCollection, front: "TAKE CARE", back: "Mach es gut" }),
    ).resolves.toMatchObject({ front: { text: "TAKE CARE", audio: null } });
    expect(await listCards()).toHaveLength(1);
  });

  it("scopes front uniqueness to a single Collection", async () => {
    const other = await createCollection({ name: "Englisch", icon: "flag-gb" });
    await createCard({ ...inDefaultCollection, front: "Take care", back: "Pass auf" });

    await expect(
      createCard({ collectionId: other.id, front: "Take care", back: "Mach es gut" }),
    ).resolves.toMatchObject({ collectionId: other.id });
    await expect(
      createCard({ collectionId: other.id, front: "take care", back: "Noch einmal" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("allows duplicate audio-only fronts, preserves scheduling on edit, and removes live bytes", async () => {
    const store = new InMemoryAudioObjectStore();
    const sessionHash = "audio-session";
    setAudioObjectStoreForTests(store);
    const firstAudio = await stageAudio(sessionHash, createWavFixture(), "audio/wav");
    const secondAudio = await stageAudio(sessionHash, createWavFixture(), "audio/wav");
    const first = await createCard(
      {
        ...inDefaultCollection,
        front: { text: null, audioId: firstAudio.id },
        back: { text: "erste Antwort", audioId: null },
      },
      sessionHash,
    );
    await expect(
      createCard(
        {
          ...inDefaultCollection,
          front: { text: null, audioId: secondAudio.id },
          back: { text: "zweite Antwort", audioId: null },
        },
        sessionHash,
      ),
    ).resolves.toMatchObject({ front: { text: null } });
    const edited = await updateCard(first.id, {
      back: { text: "geänderte Antwort" },
    });

    expect(edited).toMatchObject({ box: first.box, dueAt: first.dueAt });
    await deleteCard(first.id);
    expect(store.objects.size).toBe(1);
  });

  it("records obsolete-object deletion failures and resolves them idempotently", async () => {
    const store = new FailingAudioObjectStore();
    const sessionHash = "audio-cleanup-session";
    setAudioObjectStoreForTests(store);
    const audio = await stageAudio(sessionHash, createWavFixture(), "audio/wav");
    const card = await createCard(
      {
        ...inDefaultCollection,
        front: { text: null, audioId: audio.id },
        back: { text: "Antwort", audioId: null },
      },
      sessionHash,
    );
    store.failures.add("delete");
    await deleteCard(card.id);
    expect(store.delegate.objects.size).toBe(1);
    const pending = await getPool().query<{ attempts: number }>(
      "SELECT attempts FROM audio_cleanup_jobs WHERE audio_id=$1 AND completed_at IS NULL",
      [audio.id],
    );
    expect(pending.rows[0]?.attempts).toBe(1);

    store.failures.delete("delete");
    await expect(retryAudioCleanup()).resolves.toBe(1);
    await expect(retryAudioCleanup()).resolves.toBe(0);
    expect(store.delegate.objects.size).toBe(0);
  });

  it("rejects Tutor for an audio-only face before provider use or allowance consumption", async () => {
    const store = new InMemoryAudioObjectStore();
    const sessionHash = "audio-tutor-session";
    setAudioObjectStoreForTests(store);
    const audio = await stageAudio(sessionHash, createWavFixture(), "audio/wav");
    const card = await createCard(
      {
        ...inDefaultCollection,
        front: { text: null, audioId: audio.id },
        back: { text: "Antwort", audioId: null },
      },
      sessionHash,
    );
    const streamTutorReply = vi.fn();

    await expect(
      createTutorStream(
        card.id,
        { message: "Hilf mir", messages: [] },
        sessionHash,
        { streamTutorReply },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ type: "/problems/tutor-audio-unsupported" });
    expect(streamTutorReply).not.toHaveBeenCalled();
    const usage = await getPool().query<{ count: string }>("SELECT count(*) FROM ai_usage");
    expect(usage.rows[0]?.count).toBe("0");
  });

  it("rejects a Card written into an unknown Collection", async () => {
    await expect(
      createCard({ collectionId: crypto.randomUUID(), front: "waise", back: "orphan" }),
    ).rejects.toMatchObject({ status: 404, type: "/problems/collection-not-found" });
  });

  it("gives a migrated Collection the default icon and stores a chosen one", async () => {
    expect(await listCollections()).toMatchObject([{ id: defaultCollectionId, icon: "book" }]);
    await expect(createCollection({ name: "Englisch", icon: "flag-gb" })).resolves.toMatchObject({
      icon: "flag-gb",
    });
  });

  it("rejects Collection names that bypass stored normalization", async () => {
    await expect(
      getPool().query(
        `INSERT INTO collections (name, normalized_name) VALUES ('  Englisch  ', '  Englisch  ')`,
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(`INSERT INTO collections (name, normalized_name) VALUES ('a', 'b')`),
    ).rejects.toThrow();
  });

  it("keeps a Collection that still holds Cards, and always keeps the last one", async () => {
    const other = await createCollection({ name: "Englisch", icon: "flag-gb" });
    const card = await createCard({
      collectionId: other.id,
      front: "Take care",
      back: "Pass auf",
    });

    await expect(deleteCollection(other.id)).rejects.toMatchObject({
      status: 409,
      type: "/problems/collection-not-empty",
    });

    await deleteCard(card.id);
    await deleteCollection(other.id);
    expect(await listCollections()).toHaveLength(1);

    await expect(deleteCollection(defaultCollectionId)).rejects.toMatchObject({
      status: 409,
      type: "/problems/last-collection",
    });
  });

  it("keeps Cards when a Topic is deleted and drops Topics when a Card moves Collection", async () => {
    const english = await createCollection({ name: "Englisch", icon: "flag-gb" });
    const animals = await createTopic({
      collectionId: defaultCollectionId,
      name: "Tiere",
      icon: "animal",
    });
    const food = await createTopic({
      collectionId: defaultCollectionId,
      name: "Essen",
      icon: "food",
    });
    await createTopic({ collectionId: english.id, name: "Tiere", icon: "animal" });
    const card = await createCard({
      collectionId: defaultCollectionId,
      topicIds: [animals.id, food.id],
      front: { text: "con gà", audioId: null },
      back: { text: "Huhn", audioId: null },
    });

    expect(card.topicIds).toEqual(expect.arrayContaining([animals.id, food.id]));
    await expect(
      createTopic({ collectionId: defaultCollectionId, name: "tiere", icon: "animal" }),
    ).rejects.toMatchObject({ status: 409, type: "/problems/topic-name-conflict" });

    await deleteTopic(animals.id);
    expect(await listTopics()).toHaveLength(2);
    expect((await listCards())[0]?.topicIds).toEqual([food.id]);

    const moved = await updateCard(card.id, { collectionId: english.id });
    expect(moved.topicIds).toEqual([]);

    await deleteCard(card.id);
    await deleteCollection(english.id);
    expect(await listTopics()).toEqual([
      expect.objectContaining({ id: food.id, collectionId: defaultCollectionId }),
    ]);
  });

  it("refuses a Topic from another Collection on a Card", async () => {
    const english = await createCollection({ name: "Englisch", icon: "flag-gb" });
    const englishTopic = await createTopic({
      collectionId: english.id,
      name: "Food",
      icon: "food",
    });

    await expect(
      createCard({
        collectionId: defaultCollectionId,
        topicIds: [englishTopic.id],
        front: { text: "mèo", audioId: null },
        back: { text: "Katze", audioId: null },
      }),
    ).rejects.toMatchObject({ status: 404, type: "/problems/topic-not-found" });
  });

  it("stores the Collection in the Review snapshot the replay path reads back", async () => {
    const card = await createCard({ ...inDefaultCollection, front: "Schnee", back: "tuyết" });
    const input = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it" as const,
      reviewedAt: new Date().toISOString(),
    };
    const result = await recordReview(input);

    expect(result.card.collectionId).toBe(defaultCollectionId);
    await expect(recordReview(input)).resolves.toEqual(result);
    expect(
      (
        await getPool().query<{ collection_id: string }>(
          "SELECT result_card->>'collectionId' AS collection_id FROM reviews WHERE id=$1",
          [input.id],
        )
      ).rows[0]?.collection_id,
    ).toBe(defaultCollectionId);
  });

  it("records exact replays once and serializes distinct concurrent Grades", async () => {
    const card = await createCard({ ...inDefaultCollection, front: "steady", back: "stetig" });
    const reviewedAt = new Date().toISOString();
    const first = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it" as const,
      reviewedAt,
    };
    const result = await recordReview(first);
    await expect(recordReview(first)).resolves.toEqual(result);
    const second = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it" as const,
      reviewedAt: new Date(Date.now() + 1).toISOString(),
    };
    const third = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "almost" as const,
      reviewedAt: new Date(Date.now() + 2).toISOString(),
    };
    await Promise.all([recordReview(second), recordReview(third)]);
    const rows = await getPool().query(
      "SELECT box_before, box_after FROM reviews WHERE card_id=$1 ORDER BY recorded_at, id",
      [card.id],
    );
    expect(rows.rows).toHaveLength(3);
    expect(
      (await getPool().query<{ box: number }>("SELECT box FROM cards WHERE id=$1", [card.id]))
        .rows[0]?.box,
    ).toBe(2);
  });

  it("returns the original resulting Card for identical concurrent Review replays", async () => {
    const card = await createCard({
      ...inDefaultCollection,
      front: "immutable result",
      back: "unveränderlich",
    });
    const input = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it" as const,
      reviewedAt: new Date().toISOString(),
    };

    const [first, replay] = await Promise.all([recordReview(input), recordReview(input)]);
    expect(replay).toEqual(first);

    await getPool().query("UPDATE cards SET front_text=$1, normalized_front=$1 WHERE id=$2", [
      "changed later",
      card.id,
    ]);
    await expect(recordReview(input)).resolves.toEqual(first);
    await expect(recordReview({ ...input, grade: "almost" })).rejects.toMatchObject({
      status: 409,
      type: "/problems/review-replay-conflict",
    });
  });

  it("serializes concurrent Tutor allowance checks at both limits", async () => {
    const sessionHash = "session-boundary";
    await getPool().query(
      `INSERT INTO ai_usage (session_hash) SELECT $1 FROM generate_series(1, 59)`,
      [sessionHash],
    );
    const sessionBoundary = await Promise.allSettled([
      consumeTutorAllowance(sessionHash),
      consumeTutorAllowance(sessionHash),
    ]);
    expect(sessionBoundary.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(sessionBoundary.filter((result) => result.status === "rejected")).toHaveLength(1);

    await getPool().query("TRUNCATE ai_usage RESTART IDENTITY");
    await getPool().query(
      `INSERT INTO ai_usage (session_hash) SELECT 'daily-' || value FROM generate_series(1, 199) value`,
    );
    const dailyBoundary = await Promise.allSettled([
      consumeTutorAllowance("daily-final-a"),
      consumeTutorAllowance("daily-final-b"),
    ]);
    expect(dailyBoundary.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(dailyBoundary.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("serializes concurrent failed Login attempts at the tenth-attempt boundary", async () => {
    process.env.APP_PASSWORD_HASH = await encodePassword("correct household password");
    resetServerEnvironmentForTests();
    const request = new Request("http://localhost/api/session", {
      headers: { "x-forwarded-for": "203.0.113.42" },
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 11 }, () => login(request, { password: "incorrect password!" })),
    );
    const problems = attempts.flatMap((result) =>
      result.status === "rejected" ? [result.reason as { type?: string }] : [],
    );
    expect(problems.filter((problem) => problem.type === "/problems/wrong-password")).toHaveLength(
      10,
    );
    expect(
      problems.filter((problem) => problem.type === "/problems/login-rate-limit"),
    ).toHaveLength(1);
  });

  it("rejects Card text that bypasses stored normalization", async () => {
    await expect(
      getPool().query(
        `INSERT INTO cards (front_text, normalized_front, back_text) VALUES ('  spaced  ', '  spaced  ', 'valid')`,
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front_text, normalized_front, back_text) VALUES ('valid', 'different', 'valid')`,
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front_text, normalized_front, back_text) VALUES ('Café', 'Café', 'valid')`,
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front_text, normalized_front, back_text) VALUES ($1, $1, 'valid')`,
        ["multi\u00a0space"],
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front_text, normalized_front, back_text) VALUES ($1, $1, 'valid')`,
        ["wide\u2003space"],
      ),
    ).rejects.toThrow();
    await expect(
      getPool().query(
        `INSERT INTO cards (front_text, normalized_front, back_text) VALUES (E'\\nvalid\\n', E'\\nvalid\\n', 'valid')`,
      ),
    ).rejects.toThrow();
  });

  it("keeps legacy Card columns synchronized without repairing normalized text", async () => {
    const inserted = await getPool().query(
      `INSERT INTO cards (front, normalized_front, back)
       VALUES ('legacy front', 'legacy front', 'legacy back')
       RETURNING id, front_text, back_text`,
    );

    expect(inserted.rows[0]).toMatchObject({
      front_text: "legacy front",
      back_text: "legacy back",
    });

    const updated = await getPool().query(
      `UPDATE cards SET front='updated front', normalized_front='updated front', back='updated back'
       WHERE id=$1 RETURNING front_text, back_text`,
      [inserted.rows[0]?.id],
    );

    expect(updated.rows[0]).toMatchObject({
      front_text: "updated front",
      back_text: "updated back",
    });
  });

  it("keeps Reviews and Points after a Card is deleted", async () => {
    const card = await createCard({
      ...inDefaultCollection,
      front: "remember",
      back: "sich erinnern",
    });
    await recordReview({
      id: crypto.randomUUID(),
      cardId: card.id,
      grade: "knew_it",
      reviewedAt: new Date().toISOString(),
    });
    await deleteCard(card.id);
    await expect(getStats()).resolves.toMatchObject({
      totalPoints: 10,
      activeCardCount: 0,
      reviewsThisWeek: 1,
    });
    await expect(getPool().query("DELETE FROM cards WHERE id=$1", [card.id])).rejects.toThrow(
      "Cards must be soft deleted",
    );
    await expect(
      getPool().query("UPDATE reviews SET points_awarded=1 WHERE card_id=$1", [card.id]),
    ).rejects.toThrow("Reviews are append-only");
  });

  it("calculates Berlin target midnight across both daylight-saving transitions", async () => {
    const spring = await getPool().query<{ due_at: Date }>(
      `SELECT ((date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Berlin') + interval '1 day') AT TIME ZONE 'Europe/Berlin') AS due_at`,
      ["2026-03-28T12:00:00Z"],
    );
    const autumn = await getPool().query<{ due_at: Date }>(
      `SELECT ((date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Berlin') + interval '1 day') AT TIME ZONE 'Europe/Berlin') AS due_at`,
      ["2026-10-24T12:00:00Z"],
    );
    expect(spring.rows[0]?.due_at.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(autumn.rows[0]?.due_at.toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});
