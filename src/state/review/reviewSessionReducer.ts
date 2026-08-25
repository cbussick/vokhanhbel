import type { PlannedExercise } from "../../domain/exercisePlanner";
import type { ReviewSubmission } from "./reviewSubmission";

export type ReviewSubmissionIssue = "too-old" | "clock" | "deleted" | "conflict";

interface ReviewSession {
  id: string;
  exercises: PlannedExercise[];
  cardAttemptNumber: number;
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
}

export type ReviewSessionState =
  | { status: "idle" }
  | {
      status: "reviewing";
      reviewSession: ReviewSession;
      currentIndex: number;
      revealed: boolean;
      multipleChoice: MultipleChoiceProgress | undefined;
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
          cardAttemptNumber: 1,
          roundSubmissions: [],
          totalReviewSubmissions: 0,
          optimisticPoints: 0,
          roundNumber: 1,
        },
        currentIndex: 0,
        revealed: false,
        multipleChoice: undefined,
        issue: undefined,
        issueRequestId: undefined,
      };
    case "answerRevealed":
      return state.status === "reviewing" ? { ...state, revealed: true } : state;
    case "cardGraded": {
      if (state.status !== "reviewing") return state;
      const reviewSession = {
        ...state.reviewSession,
        cardAttemptNumber: state.reviewSession.cardAttemptNumber + 1,
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
        },
      };
    }
    case "exerciseAdvanced": {
      if (state.status !== "reviewing" || !state.multipleChoice?.resolvedSubmission) return state;
      if (state.currentIndex + 1 >= state.reviewSession.exercises.length)
        return { status: "summary", reviewSession: state.reviewSession };

      return {
        status: "reviewing",
        reviewSession: {
          ...state.reviewSession,
          cardAttemptNumber: state.reviewSession.cardAttemptNumber + 1,
        },
        currentIndex: state.currentIndex + 1,
        revealed: false,
        multipleChoice: undefined,
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
        cardAttemptNumber: state.reviewSession.cardAttemptNumber + 1,
      };

      if (exercises.length === 0 || state.currentIndex >= exercises.length)
        return { status: "summary", reviewSession };

      return {
        status: "reviewing",
        reviewSession,
        currentIndex: state.currentIndex,
        revealed: false,
        multipleChoice: undefined,
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
          cardAttemptNumber: state.reviewSession.cardAttemptNumber + 1,
          roundSubmissions: [],
          roundNumber: state.reviewSession.roundNumber + 1,
        },
        currentIndex: 0,
        revealed: false,
        multipleChoice: undefined,
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
        cardAttemptNumber: state.reviewSession.cardAttemptNumber + 1,
        roundSubmissions,
        totalReviewSubmissions: Math.max(0, state.reviewSession.totalReviewSubmissions - 1),
        optimisticPoints: Math.max(
          0,
          state.reviewSession.optimisticPoints - action.submission.optimisticPoints,
        ),
      };

      if (action.issue === "too-old") {
        const rejectedExercise = exerciseWithCard(
          reviewSession.exercises,
          action.submission.card.id,
        );
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
        issue: action.issue,
        issueRequestId: action.requestId,
      };
    }
  }
}
