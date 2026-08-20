import { describe, expect, it } from "vitest";
import { cardSchema, createCardInputSchema, updateCardInputSchema } from "./card.js";
import { createCollectionInputSchema } from "./collection.js";
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
        front: "  Take   care ",
        back: " Pass auf! ",
      }),
    ).toEqual({ collectionId, front: "Take care", back: "Pass auf!" });
  });

  it("normalizes a Collection name and keeps it within 60 characters", () => {
    expect(createCollectionInputSchema.parse({ name: "  Viet   namesisch " })).toEqual({
      name: "Viet namesisch",
    });
    expect(createCollectionInputSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(createCollectionInputSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
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
        front: "",
        back: "Meaning",
      }).success,
    ).toBe(false);
    expect(createCardInputSchema.safeParse({ front: "Take care", back: "Pass auf" }).success).toBe(
      false,
    );
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
        front: "front",
        back: "back",
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
