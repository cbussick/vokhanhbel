import { describe, expect, it } from "vitest";
import { cardSchema, createCardInputSchema, updateCardInputSchema } from "./card.js";
import { collectionInputSchema, collectionSchema, defaultCollectionIcon } from "./collection.js";
import { tutorStreamEventSchema } from "./tutor.js";
import { problemSchema } from "./problem.js";
import { reviewSubmissionInputSchema } from "./review.js";
import { loginInputSchema } from "./session.js";
import { statsSchema } from "./stats.js";

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
});
