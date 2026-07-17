import type { Card } from "../../contracts/card";
import type { ReviewSubmission } from "./reviewSubmission";

export type ReviewSubmissionIssue = "too-old" | "clock" | "deleted" | "conflict";

interface ReviewSession {
  id: string;
  cards: Card[];
  roundSubmissions: ReviewSubmission[];
  totalReviewSubmissions: number;
  optimisticPoints: number;
  roundNumber: number;
}

export type ReviewSessionState =
  | { status: "idle" }
  | {
      status: "reviewing";
      reviewSession: ReviewSession;
      currentIndex: number;
      revealed: boolean;
      issue: ReviewSubmissionIssue | undefined;
      issueRequestId: string | undefined;
    }
  | {
      status: "summary";
      reviewSession: ReviewSession;
    };

type ReviewSessionAction =
  | { type: "reviewSessionStarted"; reviewSessionId: string; cards: Card[] }
  | { type: "answerRevealed" }
  | { type: "cardGraded"; submission: ReviewSubmission }
  | { type: "forgottenRepeated" }
  | { type: "reviewSessionLeft" }
  | {
      type: "reviewSubmissionRejected";
      submission: ReviewSubmission;
      issue: ReviewSubmissionIssue;
      requestId: string | undefined;
    };

export const idleReviewSessionState: ReviewSessionState = { status: "idle" };

function findNextUngradedCard(cards: Card[], submissions: ReviewSubmission[]): number {
  const gradedCardIds = new Set(submissions.map((submission) => submission.card.id));

  return cards.findIndex((card) => !gradedCardIds.has(card.id));
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
          cards: action.cards,
          roundSubmissions: [],
          totalReviewSubmissions: 0,
          optimisticPoints: 0,
          roundNumber: 1,
        },
        currentIndex: 0,
        revealed: false,
        issue: undefined,
        issueRequestId: undefined,
      };
    case "answerRevealed":
      return state.status === "reviewing" ? { ...state, revealed: true } : state;
    case "cardGraded": {
      if (state.status !== "reviewing") return state;
      const reviewSession = {
        ...state.reviewSession,
        roundSubmissions: [...state.reviewSession.roundSubmissions, action.submission],
        totalReviewSubmissions: state.reviewSession.totalReviewSubmissions + 1,
        optimisticPoints: state.reviewSession.optimisticPoints + action.submission.optimisticPoints,
      };

      if (state.currentIndex + 1 >= reviewSession.cards.length)
        return { status: "summary", reviewSession };

      return {
        status: "reviewing",
        reviewSession,
        currentIndex: state.currentIndex + 1,
        revealed: false,
        issue: undefined,
        issueRequestId: undefined,
      };
    }
    case "forgottenRepeated": {
      if (state.status !== "summary") return state;
      const forgotten = state.reviewSession.roundSubmissions
        .filter((submission) => submission.input.grade === "forgot")
        .map((submission) => submission.card);

      if (forgotten.length === 0) return state;

      return {
        status: "reviewing",
        reviewSession: {
          ...state.reviewSession,
          cards: forgotten,
          roundSubmissions: [],
          roundNumber: state.reviewSession.roundNumber + 1,
        },
        currentIndex: 0,
        revealed: false,
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
        roundSubmissions,
        totalReviewSubmissions: Math.max(0, state.reviewSession.totalReviewSubmissions - 1),
        optimisticPoints: Math.max(
          0,
          state.reviewSession.optimisticPoints - action.submission.optimisticPoints,
        ),
      };

      if (action.issue === "too-old") {
        const cards = [
          ...reviewSession.cards.filter((card) => card.id !== action.submission.card.id),
          action.submission.card,
        ];

        return {
          status: "reviewing",
          reviewSession: { ...reviewSession, cards },
          currentIndex: Math.max(0, findNextUngradedCard(cards, roundSubmissions)),
          revealed: false,
          issue: action.issue,
          issueRequestId: action.requestId,
        };
      }

      if (action.issue === "deleted") {
        const cards = reviewSession.cards.filter((card) => card.id !== action.submission.card.id);
        const currentIndex = findNextUngradedCard(cards, roundSubmissions);

        if (currentIndex < 0)
          return { status: "summary", reviewSession: { ...reviewSession, cards } };

        return {
          status: "reviewing",
          reviewSession: { ...reviewSession, cards },
          currentIndex,
          revealed: false,
          issue: action.issue,
          issueRequestId: action.requestId,
        };
      }

      const rejectedCardIndex = reviewSession.cards.findIndex(
        (card) => card.id === action.submission.card.id,
      );

      return {
        status: "reviewing",
        reviewSession,
        currentIndex:
          rejectedCardIndex >= 0
            ? rejectedCardIndex
            : Math.min(action.submission.cardIndex, reviewSession.cards.length - 1),
        revealed: true,
        issue: action.issue,
        issueRequestId: action.requestId,
      };
    }
  }
}
