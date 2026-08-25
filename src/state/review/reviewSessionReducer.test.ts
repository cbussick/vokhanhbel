import { describe, expect, it } from "vitest";
import type { Card } from "../../contracts/card";
import type {
  FlipExercise,
  MatchingExercise,
  MultipleChoiceExercise,
  SwipeExercise,
} from "../../domain/exercisePlanner";
import { idleReviewSessionState, reviewSessionReducer } from "./reviewSessionReducer";
import type { ReviewSubmission } from "./reviewSubmission";

function card(id: string): Card {
  const now = new Date().toISOString();

  return {
    id,
    collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    topicIds: [],
    front: { text: null, audio: null },
    back: { text: "die Antwort", audio: null },
    box: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function flip(id: string): FlipExercise {
  return { kind: "flip", id, cards: [card(id)] };
}

function multipleChoice(id: string): MultipleChoiceExercise {
  return {
    kind: "multipleChoice",
    id,
    cards: [card(id)],
    options: [
      { cardId: id, text: "richtig", audio: null, correct: true },
      { cardId: "d1", text: "falsch eins", audio: null, correct: false },
      { cardId: "d2", text: "falsch zwei", audio: null, correct: false },
      { cardId: "d3", text: "falsch drei", audio: null, correct: false },
    ],
  };
}

function submission(
  exercise: FlipExercise | MultipleChoiceExercise,
  grade: ReviewSubmission["input"]["grade"],
  exerciseIndex: number,
): ReviewSubmission {
  return {
    input: {
      id: `${exercise.id}-submission`,
      cardId: exercise.cards[0]!.id,
      grade,
      reviewedAt: new Date().toISOString(),
    },
    reviewSessionId: "session",
    card: exercise.cards[0]!,
    optimisticPoints: grade === "knew_it" ? 10 : grade === "almost" ? 5 : 1,
    exerciseIndex,
  };
}

function matching(ids: string[]): MatchingExercise {
  return {
    kind: "matching",
    id: ids.join(":"),
    cards: ids.map((id) => card(id)),
    frontOrder: [...ids],
    backOrder: [...ids],
  };
}

function matchingSubmission(
  cardId: string,
  grade: ReviewSubmission["input"]["grade"],
  exerciseIndex: number,
): ReviewSubmission {
  return {
    input: { id: `${cardId}-submission`, cardId, grade, reviewedAt: new Date().toISOString() },
    reviewSessionId: "session",
    card: card(cardId),
    optimisticPoints: grade === "knew_it" ? 10 : grade === "almost" ? 5 : 1,
    exerciseIndex,
  };
}

function swipe(ids: string[]): SwipeExercise {
  return {
    kind: "swipe",
    id: ids.join(":"),
    cards: ids.map((id) => card(id)),
    deck: ids.map((id) => ({
      cardId: id,
      options: [
        { cardId: id, correct: true, text: "richtig" },
        { cardId: `${id}-d`, correct: false, text: "falsch" },
      ],
    })),
  };
}

function swipeSubmission(
  cardId: string,
  grade: ReviewSubmission["input"]["grade"],
  exerciseIndex: number,
): ReviewSubmission {
  return {
    input: { id: `${cardId}-submission`, cardId, grade, reviewedAt: new Date().toISOString() },
    reviewSessionId: "session",
    card: card(cardId),
    optimisticPoints: grade === "knew_it" ? 10 : 1,
    exerciseIndex,
  };
}

describe("Review Session Skip", () => {
  it("removes the current Card without recording a submission, points, or forgotten work", () => {
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [
        flip("11111111-1111-4111-8111-111111111111"),
        flip("22222222-2222-4222-8222-222222222222"),
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
      expect(skipped.reviewSession.exercises.map((exercise) => exercise.id)).toEqual([
        "22222222-2222-4222-8222-222222222222",
      ]);
    }
  });
});

describe("Advancing a planned Session", () => {
  it("advances past a graded flip Exercise immediately, without waiting for Weiter", () => {
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [flip("1"), flip("2")],
    });
    const graded = reviewSessionReducer(started, {
      type: "cardGraded",
      submission: submission(flip("1"), "knew_it", 0),
    });

    expect(graded).toMatchObject({ status: "reviewing", currentIndex: 1 });
  });

  it("holds a resolved multiple-choice Exercise in place until Weiter is pressed, then advances", () => {
    const exercise = multipleChoice("1");
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("2")],
    });
    const resolved = reviewSessionReducer(started, {
      type: "multipleChoiceResolved",
      optionId: "1",
      correct: true,
      submission: submission(exercise, "knew_it", 0),
    });

    expect(resolved).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      multipleChoice: { resolvedSubmission: { input: { grade: "knew_it" } } },
      reviewSession: { totalReviewSubmissions: 1, optimisticPoints: 10 },
    });

    const advanced = reviewSessionReducer(resolved, { type: "exerciseAdvanced" });

    expect(advanced).toMatchObject({
      status: "reviewing",
      currentIndex: 1,
      multipleChoice: undefined,
    });
  });

  it("moves to the summary when Weiter advances past the last Exercise", () => {
    const exercise = multipleChoice("1");
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise],
    });
    const resolved = reviewSessionReducer(started, {
      type: "multipleChoiceResolved",
      optionId: "d1",
      correct: false,
      submission: submission(exercise, "forgot", 0),
    });

    expect(reviewSessionReducer(resolved, { type: "exerciseAdvanced" })).toMatchObject({
      status: "summary",
    });
  });

  it("ignores Weiter before the Exercise has resolved", () => {
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [multipleChoice("1")],
    });
    const missed = reviewSessionReducer(started, {
      type: "multipleChoiceOptionMissed",
      optionId: "d1",
    });

    expect(reviewSessionReducer(missed, { type: "exerciseAdvanced" })).toBe(missed);
  });
});

describe("Rejection during an open Exercise", () => {
  it("reverses the optimistic Grade and re-appends the same Exercise for a too-old rejection", () => {
    const exercise = multipleChoice("1");
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("2")],
    });
    const rejectedSubmission = submission(exercise, "knew_it", 0);
    const resolved = reviewSessionReducer(started, {
      type: "multipleChoiceResolved",
      optionId: "1",
      correct: true,
      submission: rejectedSubmission,
    });
    const advanced = reviewSessionReducer(resolved, { type: "exerciseAdvanced" });
    const rejected = reviewSessionReducer(advanced, {
      type: "reviewSubmissionRejected",
      submission: rejectedSubmission,
      issue: "too-old",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      reviewSession: { totalReviewSubmissions: 0, optimisticPoints: 0 },
    });
    if (rejected.status === "reviewing") {
      expect(rejected.reviewSession.exercises.map((planned) => planned.id)).toEqual(["2", "1"]);
      expect(rejected.reviewSession.exercises[1]).toBe(exercise);
    }
  });

  it("shows a clock rejection on the still-open multiple-choice Exercise without losing its retry state", () => {
    const exercise = multipleChoice("1");
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise],
    });
    const missed = reviewSessionReducer(started, {
      type: "multipleChoiceOptionMissed",
      optionId: "d1",
    });
    const almostSubmission = submission(exercise, "almost", 0);
    const resolved = reviewSessionReducer(missed, {
      type: "multipleChoiceResolved",
      optionId: "1",
      correct: true,
      submission: almostSubmission,
    });
    const rejected = reviewSessionReducer(resolved, {
      type: "reviewSubmissionRejected",
      submission: almostSubmission,
      issue: "clock",
      requestId: "req-1",
    });

    expect(rejected).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      issue: "clock",
      issueRequestId: "req-1",
      multipleChoice: { deadOptionIds: ["d1"], resolvedSubmission: { input: { grade: "almost" } } },
      reviewSession: { totalReviewSubmissions: 0, optimisticPoints: 0 },
    });
  });

  it("removes a deleted Card's Exercise and lands on the next ungraded one", () => {
    const exercise = multipleChoice("1");
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("2")],
    });
    const rejectedSubmission = submission(exercise, "knew_it", 0);
    const resolved = reviewSessionReducer(started, {
      type: "multipleChoiceResolved",
      optionId: "1",
      correct: true,
      submission: rejectedSubmission,
    });
    const rejected = reviewSessionReducer(resolved, {
      type: "reviewSubmissionRejected",
      submission: rejectedSubmission,
      issue: "deleted",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({ status: "reviewing", currentIndex: 0 });
    if (rejected.status === "reviewing") {
      expect(rejected.reviewSession.exercises.map((planned) => planned.id)).toEqual(["2"]);
    }
  });
});

describe("Matching Exercise", () => {
  it("grades several Cards from one Exercise, one Review Submission per resolved pair", () => {
    const exercise = matching(["1", "2", "3", "4"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const firstResolved = reviewSessionReducer(started, {
      type: "matchingPairResolved",
      submission: matchingSubmission("1", "knew_it", 0),
    });

    expect(firstResolved).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      matching: { resolvedCardIds: ["1"] },
      reviewSession: { totalReviewSubmissions: 1, optimisticPoints: 10 },
    });

    const secondResolved = reviewSessionReducer(firstResolved, {
      type: "matchingPairResolved",
      submission: matchingSubmission("2", "almost", 0),
    });

    expect(secondResolved).toMatchObject({
      status: "reviewing",
      matching: { resolvedCardIds: ["1", "2"] },
      reviewSession: { totalReviewSubmissions: 2, optimisticPoints: 15 },
    });
  });

  it("marks both Cards of a mismatch tainted without grading either", () => {
    const exercise = matching(["1", "2", "3", "4"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise],
    });
    const mismatched = reviewSessionReducer(started, {
      type: "matchingPairMismatched",
      cardIds: ["1", "3"],
    });

    expect(mismatched).toMatchObject({
      status: "reviewing",
      matching: { resolvedCardIds: [], taintedCardIds: ["1", "3"] },
      reviewSession: { totalReviewSubmissions: 0 },
    });
  });

  it("ignores Weiter until every Card in the board has resolved, then advances past it", () => {
    const exercise = matching(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const oneResolved = reviewSessionReducer(started, {
      type: "matchingPairResolved",
      submission: matchingSubmission("1", "knew_it", 0),
    });

    expect(reviewSessionReducer(oneResolved, { type: "exerciseAdvanced" })).toBe(oneResolved);

    const bothResolved = reviewSessionReducer(oneResolved, {
      type: "matchingPairResolved",
      submission: matchingSubmission("2", "knew_it", 0),
    });
    const advanced = reviewSessionReducer(bothResolved, { type: "exerciseAdvanced" });

    expect(advanced).toMatchObject({ status: "reviewing", currentIndex: 1, matching: undefined });
  });

  it("shrinks the board on a per-Card too-old rejection, keeping the pairs already matched", () => {
    const exercise = matching(["1", "2", "3", "4"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const resolvedSubmission = matchingSubmission("1", "knew_it", 0);
    const resolved = reviewSessionReducer(started, {
      type: "matchingPairResolved",
      submission: resolvedSubmission,
    });
    const rejected = reviewSessionReducer(resolved, {
      type: "reviewSubmissionRejected",
      submission: resolvedSubmission,
      issue: "too-old",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      matching: { resolvedCardIds: [] },
      reviewSession: { totalReviewSubmissions: 0, optimisticPoints: 0 },
    });
    if (rejected.status === "reviewing") {
      const board = rejected.reviewSession.exercises[0] as MatchingExercise;

      // The Exercise total is untouched — the board shrinks, it doesn't disappear or requeue.
      expect(rejected.reviewSession.exercises).toHaveLength(2);
      expect(board.kind).toBe("matching");
      expect(board.cards.map((c) => c.id)).toEqual(["2", "3", "4"]);
    }
  });

  it("sends the board to a flip Card once a deleted rejection drops it below two pairs", () => {
    const exercise = matching(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise],
    });
    const rejectedSubmission = matchingSubmission("1", "almost", 0);
    const rejected = reviewSessionReducer(started, {
      type: "reviewSubmissionRejected",
      submission: rejectedSubmission,
      issue: "deleted",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({ status: "reviewing", currentIndex: 0, matching: undefined });
    if (rejected.status === "reviewing") {
      expect(rejected.reviewSession.exercises).toMatchObject([
        { kind: "flip", id: "2", cards: [{ id: "2" }] },
      ]);
    }
  });

  it("removes the board once a rejection lands on its last still-credited Card", () => {
    // Both pairs already resolved (the board is fully graded, awaiting Weiter) when a late
    // rejection reaches the last one — nothing is left to grade, so the Exercise disappears
    // exactly like a deleted Card's single-Card Exercise does.
    const exercise = matching(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const firstResolved = reviewSessionReducer(started, {
      type: "matchingPairResolved",
      submission: matchingSubmission("1", "knew_it", 0),
    });
    const bothResolved = reviewSessionReducer(firstResolved, {
      type: "matchingPairResolved",
      submission: matchingSubmission("2", "knew_it", 0),
    });
    const rejected = reviewSessionReducer(bothResolved, {
      type: "reviewSubmissionRejected",
      submission: matchingSubmission("1", "knew_it", 0),
      issue: "deleted",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({ status: "reviewing", currentIndex: 0 });
    if (rejected.status !== "reviewing") throw new Error("expected reviewing");
    expect(rejected.reviewSession.exercises.map((planned) => planned.id)).toEqual(["5"]);
  });

  it("keeps the Exercise-counted progress total unaffected by a matching board's own Card count", () => {
    const exercise = matching(["1", "2", "3", "4"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [flip("0"), exercise, flip("5")],
    });

    expect(started).toMatchObject({ reviewSession: { exercises: [{}, {}, {}] } });
    if (started.status !== "reviewing") throw new Error("expected reviewing");
    expect(started.reviewSession.exercises).toHaveLength(3);
  });

  it("never repeats a matching board's Cards — only a genuinely forgotten flip Card returns", () => {
    // Matching never records forgot (ADR-0014), so its Cards can never reach the repeat round;
    // this confirms that holds even in a round that also has a forgotten flip Card to repeat.
    const board = matching(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [board, flip("3")],
    });
    const boardResolved = reviewSessionReducer(
      reviewSessionReducer(started, {
        type: "matchingPairResolved",
        submission: matchingSubmission("1", "knew_it", 0),
      }),
      { type: "matchingPairResolved", submission: matchingSubmission("2", "almost", 0) },
    );
    const advanced = reviewSessionReducer(boardResolved, { type: "exerciseAdvanced" });
    const summary = reviewSessionReducer(advanced, {
      type: "cardGraded",
      submission: submission(flip("3"), "forgot", 1),
    });
    const repeated = reviewSessionReducer(summary, { type: "forgottenRepeated" });

    expect(repeated).toMatchObject({ status: "reviewing", currentIndex: 0 });
    if (repeated.status !== "reviewing") throw new Error("expected reviewing");
    expect(repeated.reviewSession.exercises).toMatchObject([
      { kind: "flip", id: "3", cards: [{ id: "3" }] },
    ]);
  });
});

describe("Swipe Exercise", () => {
  it("grades a correct swipe knew_it and pauses the deck on its resolution until Weiter", () => {
    const exercise = swipe(["1", "2", "3"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const resolved = reviewSessionReducer(started, {
      type: "swipeCardResolved",
      correct: true,
      submission: swipeSubmission("1", "knew_it", 0),
    });

    expect(resolved).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      swipe: { resolved: [{ cardId: "1", correct: true }], awaitingContinueCardId: "1" },
      reviewSession: { totalReviewSubmissions: 1, optimisticPoints: 10 },
    });

    const continued = reviewSessionReducer(resolved, { type: "swipeCardAdvanced" });

    expect(continued).toMatchObject({ swipe: { awaitingContinueCardId: undefined } });
  });

  it("grades a wrong swipe forgot and pauses the deck on that Card until Weiter", () => {
    const exercise = swipe(["1", "2", "3"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise],
    });
    const resolved = reviewSessionReducer(started, {
      type: "swipeCardResolved",
      correct: false,
      submission: swipeSubmission("1", "forgot", 0),
    });

    expect(resolved).toMatchObject({
      status: "reviewing",
      swipe: {
        resolved: [{ cardId: "1", correct: false }],
        awaitingContinueCardId: "1",
      },
      reviewSession: { totalReviewSubmissions: 1, optimisticPoints: 1 },
    });

    const continued = reviewSessionReducer(resolved, { type: "swipeCardAdvanced" });

    expect(continued).toMatchObject({ swipe: { awaitingContinueCardId: undefined } });
  });

  it("ignores swipeCardAdvanced while no Card is paused on a miss", () => {
    const exercise = swipe(["1", "2", "3"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise],
    });

    expect(reviewSessionReducer(started, { type: "swipeCardAdvanced" })).toBe(started);
  });

  it("ignores Weiter until every Card in the deck has resolved, then advances past it", () => {
    const exercise = swipe(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const oneResolved = reviewSessionReducer(started, {
      type: "swipeCardResolved",
      correct: true,
      submission: swipeSubmission("1", "knew_it", 0),
    });

    expect(reviewSessionReducer(oneResolved, { type: "exerciseAdvanced" })).toBe(oneResolved);

    const bothResolved = reviewSessionReducer(oneResolved, {
      type: "swipeCardResolved",
      correct: true,
      submission: swipeSubmission("2", "knew_it", 0),
    });
    const advanced = reviewSessionReducer(bothResolved, { type: "exerciseAdvanced" });

    expect(advanced).toMatchObject({ status: "reviewing", currentIndex: 1, swipe: undefined });
  });

  it("produces one Review Submission per Card and counts the deck as a single Exercise", () => {
    const exercise = swipe(["1", "2", "3"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });

    expect(started).toMatchObject({ reviewSession: { exercises: [{}, {}] } });
    if (started.status !== "reviewing") throw new Error("expected reviewing");
    expect(started.reviewSession.exercises).toHaveLength(2);

    const allResolved = ["1", "2", "3"].reduce(
      (current, id) =>
        reviewSessionReducer(current, {
          type: "swipeCardResolved",
          correct: true,
          submission: swipeSubmission(id, "knew_it", 0),
        }),
      started as ReturnType<typeof reviewSessionReducer>,
    );

    expect(allResolved).toMatchObject({ reviewSession: { totalReviewSubmissions: 3 } });
  });

  it("shrinks the deck on a per-Card too-old rejection, keeping the Cards already graded", () => {
    const exercise = swipe(["1", "2", "3"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const resolvedSubmission = swipeSubmission("1", "knew_it", 0);
    const resolved = reviewSessionReducer(started, {
      type: "swipeCardResolved",
      correct: true,
      submission: resolvedSubmission,
    });
    const rejected = reviewSessionReducer(resolved, {
      type: "reviewSubmissionRejected",
      submission: resolvedSubmission,
      issue: "too-old",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({
      status: "reviewing",
      currentIndex: 0,
      swipe: { resolved: [] },
      reviewSession: { totalReviewSubmissions: 0, optimisticPoints: 0 },
    });
    if (rejected.status === "reviewing") {
      const deck = rejected.reviewSession.exercises[0] as SwipeExercise;

      // The Exercise total is untouched — the deck shrinks, it doesn't disappear or requeue.
      expect(rejected.reviewSession.exercises).toHaveLength(2);
      expect(deck.kind).toBe("swipe");
      expect(deck.cards.map((c) => c.id)).toEqual(["2", "3"]);
    }
  });

  it("keeps the deck alive, shrunk, when the rejected Card still has ungraded Cards beside it", () => {
    const exercise = swipe(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const firstResolved = reviewSessionReducer(started, {
      type: "swipeCardResolved",
      correct: true,
      submission: swipeSubmission("1", "knew_it", 0),
    });
    const rejected = reviewSessionReducer(firstResolved, {
      type: "reviewSubmissionRejected",
      submission: swipeSubmission("1", "knew_it", 0),
      issue: "deleted",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({ status: "reviewing", currentIndex: 0 });
    if (rejected.status !== "reviewing") throw new Error("expected reviewing");
    // Card "2" is still ungraded, so the deck survives with just that one Card left.
    const deck = rejected.reviewSession.exercises[0] as SwipeExercise;

    expect(rejected.reviewSession.exercises).toHaveLength(2);
    expect(deck.cards.map((c) => c.id)).toEqual(["2"]);
  });

  it("removes the deck once a rejection lands on its last still-credited Card", () => {
    // Both Cards already resolved (the deck is fully graded, awaiting Weiter) when a late
    // rejection reaches the last one — nothing is left to grade, so the Exercise disappears
    // exactly like a deleted Card's single-Card Exercise does.
    const exercise = swipe(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise, flip("5")],
    });
    const firstResolved = reviewSessionReducer(started, {
      type: "swipeCardResolved",
      correct: true,
      submission: swipeSubmission("1", "knew_it", 0),
    });
    const bothResolved = reviewSessionReducer(firstResolved, {
      type: "swipeCardResolved",
      correct: true,
      submission: swipeSubmission("2", "knew_it", 0),
    });
    const rejected = reviewSessionReducer(bothResolved, {
      type: "reviewSubmissionRejected",
      submission: swipeSubmission("1", "knew_it", 0),
      issue: "deleted",
      requestId: undefined,
    });

    expect(rejected).toMatchObject({ status: "reviewing", currentIndex: 0 });
    if (rejected.status !== "reviewing") throw new Error("expected reviewing");
    expect(rejected.reviewSession.exercises.map((planned) => planned.id)).toEqual(["5"]);
  });

  it("never repeats a Swipe Card — a wrong swipe already grades forgot, so it repeats as a flip Card", () => {
    const exercise = swipe(["1", "2"]);
    const started = reviewSessionReducer(idleReviewSessionState, {
      type: "reviewSessionStarted",
      reviewSessionId: "session",
      exercises: [exercise],
    });
    const firstResolved = reviewSessionReducer(started, {
      type: "swipeCardResolved",
      correct: false,
      submission: swipeSubmission("1", "forgot", 0),
    });
    const continued = reviewSessionReducer(firstResolved, { type: "swipeCardAdvanced" });
    const bothResolved = reviewSessionReducer(continued, {
      type: "swipeCardResolved",
      correct: true,
      submission: swipeSubmission("2", "knew_it", 0),
    });
    const advanced = reviewSessionReducer(bothResolved, { type: "exerciseAdvanced" });

    expect(advanced).toMatchObject({ status: "summary" });

    const repeated = reviewSessionReducer(advanced, { type: "forgottenRepeated" });

    expect(repeated).toMatchObject({ status: "reviewing", currentIndex: 0 });
    if (repeated.status !== "reviewing") throw new Error("expected reviewing");
    expect(repeated.reviewSession.exercises).toMatchObject([
      { kind: "flip", id: "1", cards: [{ id: "1" }] },
    ]);
  });
});
