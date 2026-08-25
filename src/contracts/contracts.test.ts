import { describe, expect, it } from "vitest";
import { cardSchema, createCardInputSchema, updateCardInputSchema } from "./card.js";
import { collectionInputSchema, collectionSchema, defaultCollectionIcon } from "./collection.js";
import { problemSchema } from "./problem.js";
import { reviewSubmissionInputSchema } from "./review.js";
import { loginInputSchema } from "./session.js";
import { statsSchema } from "./stats.js";
import {
  createTopicInputSchema,
  defaultTopicIcon,
  topicInputSchema,
  topicSchema,
} from "./topic.js";
import { tutorInputSchema, tutorStreamEventSchema } from "./tutor.js";

describe("public contracts", () => {
  it("normalizes valid Card input at the boundary", () => {
    const collectionId = crypto.randomUUID();

    expect(
      createCardInputSchema.parse({
        collectionId,
        front: { text: "  Take   care ", audioId: null },
        back: { text: " Pass auf! ", audioId: null },
      }),
    ).toEqual({
      collectionId,
      topicIds: [],
      front: { text: "Take care", audioId: null },
      back: { text: "Pass auf!", audioId: null },
    });

    expect(
      createCardInputSchema.safeParse({
        collectionId,
        front: { text: null, audioId: crypto.randomUUID() },
        back: { text: "x".repeat(1_000), audioId: null },
      }).success,
    ).toBe(true);
  });

  it("normalizes a Collection name and keeps it within 60 characters", () => {
    expect(collectionInputSchema.parse({ name: "  Viet   namesisch ", icon: "flag-vn" })).toEqual({
      name: "Viet namesisch",
      icon: "flag-vn",
    });
    expect(collectionInputSchema.safeParse({ name: "  ", icon: "book" }).success).toBe(false);
    expect(collectionInputSchema.safeParse({ name: "x".repeat(61), icon: "book" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown Collection icon on write but degrades it on read", () => {
    expect(collectionInputSchema.safeParse({ name: "Englisch", icon: "flag-xx" }).success).toBe(
      false,
    );

    const now = new Date().toISOString();
    // A Collection written by a newer deploy must still render on an older client.
    expect(
      collectionSchema.parse({
        id: crypto.randomUUID(),
        name: "Englisch",
        icon: "flag-xx",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).icon,
    ).toBe(defaultCollectionIcon);
  });

  it("moves a Card between Collections without other fields", () => {
    expect(updateCardInputSchema.safeParse({ collectionId: crypto.randomUUID() }).success).toBe(
      true,
    );
    expect(updateCardInputSchema.safeParse({}).success).toBe(false);
  });

  it("normalizes a Topic name and keeps it inside one Collection", () => {
    const collectionId = crypto.randomUUID();

    expect(
      createTopicInputSchema.parse({
        collectionId,
        name: "  Tie   re ",
        icon: "animal",
      }),
    ).toEqual({ collectionId, name: "Tie re", icon: "animal" });
    expect(topicInputSchema.safeParse({ name: "  ", icon: "shapes" }).success).toBe(false);
    expect(createTopicInputSchema.safeParse({ name: "Tiere", icon: "animal" }).success).toBe(false);
  });

  it("rejects an unknown Topic icon on write but degrades it on read", () => {
    expect(topicInputSchema.safeParse({ name: "Tiere", icon: "flag-vn" }).success).toBe(false);

    const now = new Date().toISOString();
    expect(
      topicSchema.parse({
        id: crypto.randomUUID(),
        collectionId: crypto.randomUUID(),
        name: "Tiere",
        icon: "flag-vn",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).icon,
    ).toBe(defaultTopicIcon);
  });

  it("defaults omitted Card Topics and accepts Topic-only updates", () => {
    const collectionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const topicId = crypto.randomUUID();

    expect(
      cardSchema.parse({
        id: crypto.randomUUID(),
        collectionId,
        front: { text: "front", audio: null },
        back: { text: "back", audio: null },
        box: 0,
        dueAt: now,
        lastReviewedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).topicIds,
    ).toEqual([]);
    expect(
      createCardInputSchema.parse({
        collectionId,
        front: { text: "mèo", audioId: null },
        back: { text: "Katze", audioId: null },
      }).topicIds,
    ).toEqual([]);
    expect(updateCardInputSchema.safeParse({ topicIds: [topicId] }).success).toBe(true);
    expect(
      createCardInputSchema.parse({
        collectionId,
        topicIds: [topicId],
        front: { text: "mèo", audioId: null },
        back: { text: "Katze", audioId: null },
      }).topicIds,
    ).toEqual([topicId]);
  });

  it("rejects invalid Card and Review shapes", () => {
    expect(
      createCardInputSchema.safeParse({
        collectionId: crypto.randomUUID(),
        front: { text: null, audioId: null },
        back: { text: "Meaning", audioId: null },
      }).success,
    ).toBe(false);
    expect(
      createCardInputSchema.safeParse({
        front: { text: "Take care", audioId: null },
        back: { text: "Pass auf", audioId: null },
      }).success,
    ).toBe(false);
    expect(
      reviewSubmissionInputSchema.safeParse({
        id: "not-a-uuid",
        cardId: crypto.randomUUID(),
        grade: "great",
        reviewedAt: "today",
      }).success,
    ).toBe(false);
  });

  it("accepts shared passwords from six through 128 characters", () => {
    expect(loginInputSchema.safeParse({ password: "123456" }).success).toBe(true);
    expect(loginInputSchema.safeParse({ password: "12345" }).success).toBe(false);
    expect(loginInputSchema.safeParse({ password: "x".repeat(129) }).success).toBe(false);
  });

  it("accepts settled resource and problem shapes", () => {
    const now = new Date().toISOString();
    expect(
      cardSchema.safeParse({
        id: crypto.randomUUID(),
        collectionId: crypto.randomUUID(),
        front: { text: "front", audio: null },
        back: { text: "back", audio: null },
        box: 0,
        dueAt: now,
        lastReviewedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).success,
    ).toBe(true);
    expect(
      statsSchema.safeParse({
        totalPoints: 0,
        activeCardCount: 0,
        reviewsThisWeek: 0,
        currentStreak: 0,
        bestDay: null,
        dailyRecap: null,
      }).success,
    ).toBe(true);
    expect(
      problemSchema.safeParse({
        type: "/problems/invalid-request",
        title: "Ungültige Anfrage",
        status: 422,
        instance: `urn:uuid:${crypto.randomUUID()}`,
      }).success,
    ).toBe(true);
  });

  it("validates Tutor stream events before the client consumes them", () => {
    expect(
      tutorStreamEventSchema.parse({ event: "delta", data: { text: "Ein Beispiel" } }),
    ).toEqual({ event: "delta", data: { text: "Ein Beispiel" } });
    expect(
      tutorStreamEventSchema.safeParse({ event: "done", data: { truncated: "no" } }).success,
    ).toBe(false);
    expect(
      tutorStreamEventSchema.safeParse({
        event: "error",
        data: { type: "/problems/unexpected" },
      }).success,
    ).toBe(false);
  });

  it("accepts at most 16 prior Tutor Conversation messages", () => {
    const messages = Array.from({ length: 16 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Nachricht ${index + 1}`,
    }));

    expect(tutorInputSchema.safeParse({ message: "Noch eine Frage", messages }).success).toBe(true);
    expect(
      tutorInputSchema.safeParse({
        message: "Eine Frage zu viel",
        messages: [...messages, { role: "user", content: "Nachricht 17" }],
      }).success,
    ).toBe(false);
  });
});
