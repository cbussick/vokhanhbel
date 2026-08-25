import { describe, expect, it } from "vitest";
import type { Card } from "../../contracts/card";
import type { FlipExercise, MultipleChoiceExercise } from "../../domain/exercisePlanner";
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
      { cardId: id, text: "richtig", correct: true },
      { cardId: "d1", text: "falsch eins", correct: false },
      { cardId: "d2", text: "falsch zwei", correct: false },
      { cardId: "d3", text: "falsch drei", correct: false },
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
