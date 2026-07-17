import { describe, expect, it } from "vitest";
import { cardSchema, createCardInputSchema } from "./card";
import { khunhphapStreamEventSchema } from "./khunhphap";
import { problemSchema } from "./problem";
import { reviewSubmissionInputSchema } from "./review";
import { loginInputSchema } from "./session";
import { statsSchema } from "./stats";

describe("public contracts", () => {
  it("normalizes valid Card input at the boundary", () => {
    expect(createCardInputSchema.parse({ front: "  Take   care ", back: " Pass auf! " })).toEqual({
      front: "Take care",
      back: "Pass auf!",
    });
  });

  it("rejects invalid Card and Review shapes", () => {
    expect(createCardInputSchema.safeParse({ front: "", back: "Meaning" }).success).toBe(false);
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

  it("validates Khunhphap stream events before the client consumes them", () => {
    expect(
      khunhphapStreamEventSchema.parse({ event: "delta", data: { text: "Ein Beispiel" } }),
    ).toEqual({ event: "delta", data: { text: "Ein Beispiel" } });
    expect(
      khunhphapStreamEventSchema.safeParse({ event: "done", data: { truncated: "no" } }).success,
    ).toBe(false);
    expect(
      khunhphapStreamEventSchema.safeParse({
        event: "error",
        data: { type: "/problems/unexpected" },
      }).success,
    ).toBe(false);
  });
});
