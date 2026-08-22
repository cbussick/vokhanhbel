import { describe, expect, it } from "vitest";
import type { Card } from "../../contracts/card";
import { idleReviewSessionState, reviewSessionReducer } from "./reviewSessionReducer";

function card(id: string): Card {
  const now = new Date().toISOString();

  return {
    id,
    collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    topicIds: [],
    front: { text: null, audio: null },
    back: { text: null, audio: null },
    box: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

describe("Review Session Skip", () => {
  it("removes the current Card without recording a submission, points, or forgotten work", () => {
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      cards: [
        card("11111111-1111-4111-8111-111111111111"),
        card("22222222-2222-4222-8222-222222222222"),
      ],
    });
    const skipped = reviewSessionReducer(started, { type: "cardSkipped" });

    expect(skipped).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      reviewSession: {
        totalReviewSubmissions: 0,
        optimisticPoints: 0,
        roundSubmissions: [],
      },
    });
    if (skipped.status === "reviewing") {
      expect(skipped.reviewSession.cards.map((value) => value.id)).toEqual([
        "22222222-2222-4222-8222-222222222222",
      ]);
    }
  });
});
