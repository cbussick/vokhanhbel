import type { MatchingExercise, PlannedExercise } from "../../domain/exercisePlanner";
import type { ReviewSubmission } from "./reviewSubmission";

export type ReviewSubmissionIssue = "too-old" | "clock" | "deleted" | "conflict";

/**
 * Whether an issue stops the Learner answering until it clears. A wrong device clock or a
 * conflicting Review would both record a Grade that cannot be trusted, so input waits; `too-old`
 * and `deleted` instead reshape the queue and leave her free to carry on.
 */
export function issueBlocksInput(issue: ReviewSubmissionIssue | undefined): boolean {
  return issue === "clock" || issue === "conflict";
}

/** A matching Exercise falling below this many un-graded pairs sends what's left to flip Cards. */
const matchingMinimumPairs = 2;

interface ReviewSession {
  id: string;
  exercises: PlannedExercise[];
  exerciseAttemptNumber: number;
  roundSubmissions: ReviewSubmission[];
  totalReviewSubmissions: number;
  optimisticPoints: number;
  roundNumber: number;
}

/** Progress through the current multiple-choice Exercise. Reset whenever `currentIndex` moves. */
interface MultipleChoiceProgress {
  deadOptionIds: string[];
  /** Set once the Exercise's verdict is final; the Session advances past it only on "Weiter". */
  resolvedSubmission: ReviewSubmission | undefined;
  /** The option whose pick produced `resolvedSubmission` — the "chosen option" the Tutor learns. */
  resolvedOptionId: string | undefined;
}

/**
 * Progress through the current matching Exercise. Unlike multiple choice, each pair grades and
 * enqueues its Review Submission the moment it resolves rather than waiting for the whole board —
 * that is what lets leaving mid-board keep the pairs already matched. Reset whenever `currentIndex`
 * moves.
 */
interface MatchingProgress {
  /** Cards already graded — matched correctly, in resolution order. */
  resolvedCardIds: string[];
  /** Cards that have been part of at least one wrong pairing so far, so they grade `almost`
   * rather than `knew_it` once resolved. Never cleared once set, even across a rejection. */
  taintedCardIds: string[];
}

/**
 * The verdict on the current Swipe Exercise, once it has one. Unlike multiple choice there is no
 * retry: a swipe grades — and enqueues its Review Submission — the instant it commits, correct or
 * wrong. Which specific option was chosen doesn't need recording either; a Swipe Card has exactly
 * two, so `correct` alone tells the view which one it was — the correct option's own text when
 * `true`, the other (only wrong) option's text when `false`. See `SwipeExerciseView.tutorExercise`
 * in ReviewSessionContext.tsx. Reset whenever `currentIndex` moves.
 */
interface SwipeProgress {
  correct: boolean;
}

export type ReviewSessionState =
  | { status: "idle" }
  | {
      status: "reviewing";
      reviewSession: ReviewSession;
      currentIndex: number;
      revealed: boolean;
      multipleChoice: MultipleChoiceProgress | undefined;
      matching: MatchingProgress | undefined;
      swipe: SwipeProgress | undefined;
      issue: ReviewSubmissionIssue | undefined;
      issueRequestId: string | undefined;
    }
  | {
      status: "summary";
      reviewSession: ReviewSession;
    };

type ReviewSessionAction =
  | { type: "reviewSessionStarted"; reviewSessionId: string; exercises: PlannedExercise[] }
  | { type: "answerRevealed" }
  | { type: "cardGraded"; submission: ReviewSubmission }
  | { type: "multipleChoiceOptionMissed"; optionId: string }
  | {
      type: "multipleChoiceResolved";
      optionId: string;
      correct: boolean;
      submission: ReviewSubmission;
    }
  | { type: "matchingPairMismatched"; cardIds: [string, string] }
  | { type: "matchingPairResolved"; submission: ReviewSubmission }
  | { type: "swipeCardResolved"; correct: boolean; submission: ReviewSubmission }
  | { type: "exerciseAdvanced" }
  | { type: "cardSkipped" }
  | { type: "forgottenRepeated" }
  | { type: "reviewSessionLeft" }
  | {
      type: "reviewSubmissionRejected";
      submission: ReviewSubmission;
      issue: ReviewSubmissionIssue;
      requestId: string | undefined;
    };

export const idleReviewSessionState: ReviewSessionState = { status: "idle" };

function findNextUngradedExercise(
  exercises: PlannedExercise[],
  submissions: ReviewSubmission[],
): number {
  const gradedCardIds = new Set(submissions.map((submission) => submission.card.id));

  return exercises.findIndex((exercise) =>
    exercise.cards.some((card) => !gradedCardIds.has(card.id)),
  );
}

function exerciseWithCard(
  exercises: PlannedExercise[],
  cardId: string,
): PlannedExercise | undefined {
  return exercises.find((exercise) => exercise.cards.some((card) => card.id === cardId));
}

interface MatchingShrinkResult {
  replacement: PlannedExercise | undefined;
  matching: MatchingProgress | undefined;
}

/**
 * Removes `removedCardId` from a matching Exercise after its Review Submission is rejected as
 * `deleted` or `too-old` — the board shrinks rather than the Card getting re-asked, since re-doing
 * one pair on an otherwise-progressed board doesn't make sense the way redoing a single-Card
 * Exercise does. Losing the pair's Review is accepted as offline grading's best effort (ADR-0009).
 *
 * A board with nothing left to grade disappears entirely, like a deleted Card's Exercise does.
 * One left below the two-pair minimum finishes as a plain flip Card instead — matching two entries
 * that are already known to be the only pair left teaches nothing. Otherwise the board carries on
 * with one fewer pair, and the Exercise total is untouched either way.
 */
function shrinkMatchingExercise(
  exercise: MatchingExercise,
  matching: MatchingProgress | undefined,
  removedCardId: string,
): MatchingShrinkResult {
  const cards = exercise.cards.filter((card) => card.id !== removedCardId);
  const resolvedCardIds = (matching?.resolvedCardIds ?? []).filter((id) => id !== removedCardId);
  const taintedCardIds = (matching?.taintedCardIds ?? []).filter((id) => id !== removedCardId);
  const unresolved = cards.filter((card) => !resolvedCardIds.includes(card.id));

  if (unresolved.length === 0) return { replacement: undefined, matching: undefined };

  if (unresolved.length < matchingMinimumPairs)
    return {
      replacement: { kind: "flip", id: unresolved[0]!.id, cards: [unresolved[0]!] },
      matching: undefined,
    };

  return {
    replacement: { ...exercise, cards },
    matching: { resolvedCardIds, taintedCardIds },
  };
}

export function reviewSessionReducer(
  state: ReviewSessionState,
  action: ReviewSessionAction,
): ReviewSessionState {
  switch (action.type) {
    case "reviewSessionStarted":
      return {
        status: "reviewing",
        reviewSession: {
          id: action.reviewSessionId,
          exercises: action.exercises,
          exerciseAttemptNumber: 1,
          roundSubmissions: [],
          totalReviewSubmissions: 0,
          optimisticPoints: 0,
          roundNumber: 1,
        },
        currentIndex: 0,
        revealed: false,
        multipleChoice: undefined,
        matching: undefined,
        swipe: undefined,
        issue: undefined,
        issueRequestId: undefined,
      };
    case "answerRevealed":
      return state.status === "reviewing" ? { ...state, revealed: true } : state;
    case "cardGraded": {
      if (state.status !== "reviewing") return state;
      const reviewSession = {
        ...state.reviewSession,
        exerciseAttemptNumber: state.reviewSession.exerciseAttemptNumber + 1,
        roundSubmissions: [...state.reviewSession.roundSubmissions, action.submission],
        totalReviewSubmissions: state.reviewSession.totalReviewSubmissions + 1,
        optimisticPoints: state.reviewSession.optimisticPoints + action.submission.optimisticPoints,
      };

      if (state.currentIndex + 1 >= reviewSession.exercises.length)
        return { status: "summary", reviewSession };

      return {
        status: "reviewing",
        reviewSession,
        currentIndex: state.currentIndex + 1,
        revealed: false,
        multipleChoice: undefined,
        matching: undefined,
        swipe: undefined,
        issue: undefined,
        issueRequestId: undefined,
      };
    }
    case "multipleChoiceOptionMissed": {
      if (state.status !== "reviewing") return state;

      return {
        ...state,
        multipleChoice: {
          deadOptionIds: [...(state.multipleChoice?.deadOptionIds ?? []), action.optionId],
          resolvedSubmission: undefined,
          resolvedOptionId: undefined,
        },
      };
    }
    case "multipleChoiceResolved": {
      if (state.status !== "reviewing") return state;
      const deadOptionIds = state.multipleChoice?.deadOptionIds ?? [];
      const reviewSession = {
        ...state.reviewSession,
        roundSubmissions: [...state.reviewSession.roundSubmissions, action.submission],
        totalReviewSubmissions: state.reviewSession.totalReviewSubmissions + 1,
        optimisticPoints: state.reviewSession.optimisticPoints + action.submission.optimisticPoints,
      };

      return {
        ...state,
        reviewSession,
        multipleChoice: {
          deadOptionIds: action.correct ? deadOptionIds : [...deadOptionIds, action.optionId],
          resolvedSubmission: action.submission,
          resolvedOptionId: action.optionId,
        },
      };
    }
    case "matchingPairMismatched": {
      if (state.status !== "reviewing") return state;
      const taintedCardIds = new Set([
        ...(state.matching?.taintedCardIds ?? []),
        ...action.cardIds,
      ]);

      return {
        ...state,
        matching: {
          resolvedCardIds: state.matching?.resolvedCardIds ?? [],
          taintedCardIds: [...taintedCardIds],
        },
      };
    }
    case "matchingPairResolved": {
      if (state.status !== "reviewing") return state;
      const reviewSession = {
        ...state.reviewSession,
        roundSubmissions: [...state.reviewSession.roundSubmissions, action.submission],
        totalReviewSubmissions: state.reviewSession.totalReviewSubmissions + 1,
        optimisticPoints: state.reviewSession.optimisticPoints + action.submission.optimisticPoints,
      };

      return {
        ...state,
        reviewSession,
        matching: {
          resolvedCardIds: [...(state.matching?.resolvedCardIds ?? []), action.submission.card.id],
          taintedCardIds: state.matching?.taintedCardIds ?? [],
        },
      };
    }
    case "swipeCardResolved": {
      if (state.status !== "reviewing") return state;
      const reviewSession = {
        ...state.reviewSession,
        roundSubmissions: [...state.reviewSession.roundSubmissions, action.submission],
        totalReviewSubmissions: state.reviewSession.totalReviewSubmissions + 1,
        optimisticPoints: state.reviewSession.optimisticPoints + action.submission.optimisticPoints,
      };

      return { ...state, reviewSession, swipe: { correct: action.correct } };
    }
    case "exerciseAdvanced": {
      if (state.status !== "reviewing") return state;
      const exercise = state.reviewSession.exercises[state.currentIndex];
      const resolved =
        exercise?.kind === "multipleChoice"
          ? Boolean(state.multipleChoice?.resolvedSubmission)
          : exercise?.kind === "matching"
            ? (state.matching?.resolvedCardIds.length ?? 0) === exercise.cards.length
            : exercise?.kind === "swipe"
              ? state.swipe !== undefined
              : false;

      if (!resolved) return state;
      if (state.currentIndex + 1 >= state.reviewSession.exercises.length)
        return { status: "summary", reviewSession: state.reviewSession };

      return {
        status: "reviewing",
        reviewSession: {
          ...state.reviewSession,
          exerciseAttemptNumber: state.reviewSession.exerciseAttemptNumber + 1,
        },
        currentIndex: state.currentIndex + 1,
        revealed: false,
        multipleChoice: undefined,
        matching: undefined,
        swipe: undefined,
        issue: undefined,
        issueRequestId: undefined,
      };
    }
    case "cardSkipped": {
      if (state.status !== "reviewing") return state;
      const exercises = state.reviewSession.exercises.filter(
        (_, index) => index !== state.currentIndex,
      );
      const reviewSession = {
        ...state.reviewSession,
        exercises,
        exerciseAttemptNumber: state.reviewSession.exerciseAttemptNumber + 1,
      };

      if (exercises.length === 0 || state.currentIndex >= exercises.length)
        return { status: "summary", reviewSession };

      return {
        status: "reviewing",
        reviewSession,
        currentIndex: state.currentIndex,
        revealed: false,
        multipleChoice: undefined,
        matching: undefined,
        swipe: undefined,
        issue: undefined,
        issueRequestId: undefined,
      };
    }
    case "forgottenRepeated": {
      if (state.status !== "summary") return state;
      // Cards graded forgot repeat as flip Cards, never multiple choice — see ADR-0014.
      const forgotten = state.reviewSession.roundSubmissions
        .filter((submission) => submission.input.grade === "forgot")
        .map((submission): PlannedExercise => ({
          kind: "flip",
          id: submission.card.id,
          cards: [submission.card],
        }));

      if (forgotten.length === 0) return state;

      return {
        status: "reviewing",
        reviewSession: {
          ...state.reviewSession,
          exercises: forgotten,
          exerciseAttemptNumber: state.reviewSession.exerciseAttemptNumber + 1,
          roundSubmissions: [],
          roundNumber: state.reviewSession.roundNumber + 1,
        },
        currentIndex: 0,
        revealed: false,
        multipleChoice: undefined,
        matching: undefined,
        swipe: undefined,
        issue: undefined,
        issueRequestId: undefined,
      };
    }
    case "reviewSessionLeft":
      return idleReviewSessionState;
    case "reviewSubmissionRejected": {
      if (state.status === "idle" || state.reviewSession.id !== action.submission.reviewSessionId)
        return state;
      const roundSubmissions = state.reviewSession.roundSubmissions.filter(
        (submission) => submission.input.id !== action.submission.input.id,
      );
      const reviewSession = {
        ...state.reviewSession,
        exerciseAttemptNumber: state.reviewSession.exerciseAttemptNumber + 1,
        roundSubmissions,
        totalReviewSubmissions: Math.max(0, state.reviewSession.totalReviewSubmissions - 1),
        optimisticPoints: Math.max(
          0,
          state.reviewSession.optimisticPoints - action.submission.optimisticPoints,
        ),
      };

      const rejectedExercise = exerciseWithCard(reviewSession.exercises, action.submission.card.id);

      // A matching board shrinks rather than following the single-Card too-old/deleted paths below:
      // re-appending or dropping the whole board would throw away the pairs already graded. A Swipe
      // Exercise grades one Card and so has nothing to protect — it takes those paths like any
      // other single-Card Exercise. See shrinkMatchingExercise.
      if (
        (action.issue === "too-old" || action.issue === "deleted") &&
        rejectedExercise?.kind === "matching"
      ) {
        const shrunk = shrinkMatchingExercise(
          rejectedExercise,
          state.status === "reviewing" ? state.matching : undefined,
          action.submission.card.id,
        );
        const exercises = reviewSession.exercises.flatMap((exercise) =>
          exercise === rejectedExercise
            ? shrunk.replacement
              ? [shrunk.replacement]
              : []
            : [exercise],
        );
        const currentIndex = findNextUngradedExercise(exercises, roundSubmissions);

        if (currentIndex < 0)
          return { status: "summary", reviewSession: { ...reviewSession, exercises } };

        const replaced =
          shrunk.replacement !== undefined && exercises[currentIndex] === shrunk.replacement;

        return {
          status: "reviewing",
          reviewSession: { ...reviewSession, exercises },
          currentIndex,
          revealed: false,
          multipleChoice: undefined,
          matching: replaced ? shrunk.matching : undefined,
          swipe: undefined,
          issue: action.issue,
          issueRequestId: action.requestId,
        };
      }

      if (action.issue === "too-old") {
        const exercises = rejectedExercise
          ? [
              ...reviewSession.exercises.filter((exercise) => exercise !== rejectedExercise),
              rejectedExercise,
            ]
          : reviewSession.exercises;

        return {
          status: "reviewing",
          reviewSession: { ...reviewSession, exercises },
          currentIndex: Math.max(0, findNextUngradedExercise(exercises, roundSubmissions)),
          revealed: false,
          multipleChoice: undefined,
          matching: undefined,
          swipe: undefined,
          issue: action.issue,
          issueRequestId: action.requestId,
        };
      }

      if (action.issue === "deleted") {
        const exercises = reviewSession.exercises.filter(
          (exercise) => !exercise.cards.some((card) => card.id === action.submission.card.id),
        );
        const currentIndex = findNextUngradedExercise(exercises, roundSubmissions);

        if (currentIndex < 0)
          return { status: "summary", reviewSession: { ...reviewSession, exercises } };

        return {
          status: "reviewing",
          reviewSession: { ...reviewSession, exercises },
          currentIndex,
          revealed: false,
          multipleChoice: undefined,
          matching: undefined,
          swipe: undefined,
          issue: action.issue,
          issueRequestId: action.requestId,
        };
      }

      const rejectedExerciseIndex = reviewSession.exercises.findIndex((exercise) =>
        exercise.cards.some((card) => card.id === action.submission.card.id),
      );
      const currentIndex =
        rejectedExerciseIndex >= 0
          ? rejectedExerciseIndex
          : Math.min(action.submission.exerciseIndex, reviewSession.exercises.length - 1);

      return {
        status: "reviewing",
        reviewSession,
        currentIndex,
        revealed: true,
        multipleChoice:
          state.status === "reviewing" && currentIndex === state.currentIndex
            ? state.multipleChoice
            : undefined,
        matching:
          state.status === "reviewing" && currentIndex === state.currentIndex
            ? state.matching
            : undefined,
        swipe:
          state.status === "reviewing" && currentIndex === state.currentIndex
            ? state.swipe
            : undefined,
        issue: action.issue,
        issueRequestId: action.requestId,
      };
    }
  }
}
