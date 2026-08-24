import { createContext, type ReactNode, useContext, useReducer, useState } from "react";
import { apiPaths } from "../contracts/apiPaths";
import type { Card } from "../contracts/card";
import { problemTypes } from "../contracts/problem";
import type { ReviewSubmissionInput } from "../contracts/review";
import type { Grade } from "../domain/review";
import { getPointsForGrade, reviewSessionSize } from "../domain/review";
import { ApiError } from "../lib/apiClient";
import {
  idleReviewSessionState,
  reviewSessionReducer,
  type ReviewSessionState,
  type ReviewSubmissionIssue,
} from "./review/reviewSessionReducer";
import type { ReviewSubmission } from "./review/reviewSubmission";
import { useReviewSubmissions } from "./ReviewSubmissionContext";

interface IdleView {
  kind: "idle";
}

interface CardView {
  kind: "card";
  currentCard: Card;
  position: number;
  total: number;
  revealed: boolean;
  issue: ReviewSubmissionIssue | undefined;
  issueRequestId: string | undefined;
  tutorConversation: TutorConversationMessage[];
}

interface SummaryView {
  kind: "summary";
  cumulativeReviewSubmissions: number;
  cumulativeOptimisticPoints: number;
  firstRound: boolean;
  canRepeatForgotten: boolean;
}

export type ReviewSessionView = IdleView | CardView | SummaryView;

export interface TutorConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface ReviewSessionContextValue {
  view: ReviewSessionView;
  startReviewSession: (cards: Card[]) => void;
  revealAnswer: () => void;
  gradeCard: (grade: Grade) => void;
  skipCard: () => void;
  repeatForgotten: () => void;
  leaveReviewSession: () => void;
  updateTutorConversation: (
    update: (messages: TutorConversationMessage[]) => TutorConversationMessage[],
  ) => void;
}

const ReviewSessionContext = createContext<ReviewSessionContextValue | undefined>(undefined);

function getReviewSubmissionIssue(error: unknown): ReviewSubmissionIssue {
  const type = error instanceof ApiError ? error.problem.type : "";

  if (type === problemTypes.reviewTooOld) return "too-old";
  if (type === problemTypes.deviceClockAhead) return "clock";
  if (type === problemTypes.cardNotFound) return "deleted";

  return "conflict";
}

function getRequestId(error: unknown): string | undefined {
  return error instanceof ApiError ? error.requestId : undefined;
}

function getCardAttemptKey(state: ReviewSessionState): string | undefined {
  if (state.status !== "reviewing") return undefined;

  return `${state.reviewSession.id}:${state.reviewSession.cardAttemptNumber}`;
}

function toReviewSessionView(
  state: ReviewSessionState,
  tutorConversation: { attemptKey: string; messages: TutorConversationMessage[] },
): ReviewSessionView {
  if (state.status === "idle") return { kind: "idle" };
  if (state.status === "summary") {
    return {
      kind: "summary",
      cumulativeReviewSubmissions: state.reviewSession.totalReviewSubmissions,
      cumulativeOptimisticPoints: state.reviewSession.optimisticPoints,
      firstRound: state.reviewSession.roundNumber === 1,
      canRepeatForgotten: state.reviewSession.roundSubmissions.some(
        (submission) => submission.input.grade === "forgot",
      ),
    };
  }

  const currentCard = state.reviewSession.cards[state.currentIndex];

  if (!currentCard) return { kind: "idle" };

  return {
    kind: "card",
    currentCard,
    position: state.currentIndex + 1,
    total: state.reviewSession.cards.length,
    revealed: state.revealed,
    issue: state.issue,
    issueRequestId: state.issueRequestId,
    tutorConversation:
      tutorConversation.attemptKey === getCardAttemptKey(state) ? tutorConversation.messages : [],
  };
}

export function ReviewSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reviewSessionReducer, idleReviewSessionState);
  const [tutorConversation, setTutorConversation] = useState<{
    attemptKey: string;
    messages: TutorConversationMessage[];
  }>({ attemptKey: "", messages: [] });
  const { enqueueSubmission } = useReviewSubmissions();

  const handleRejectedReviewSubmission = (submission: ReviewSubmission, error: unknown) => {
    dispatch({
      type: "reviewSubmissionRejected",
      submission,
      issue: getReviewSubmissionIssue(error),
      requestId: getRequestId(error),
    });
  };

  const startReviewSession = (cards: Card[]) => {
    const initialQueue = cards.slice(0, reviewSessionSize);

    if (initialQueue.length === 0) return;
    dispatch({
      type: "reviewSessionStarted",
      reviewSessionId: crypto.randomUUID(),
      cards: initialQueue,
    });
    const audioIds = initialQueue.flatMap((card) =>
      [card.front.audio?.id, card.back.audio?.id].filter((id): id is string => Boolean(id)),
    );

    for (const audioId of audioIds) {
      const init: RequestInit & { priority: "low" } = {
        credentials: "same-origin",
        cache: "force-cache",
        priority: "low",
      };

      void fetch(apiPaths.audio(audioId), init)
        .then((response) => response.arrayBuffer())
        .catch(() => undefined);
    }
  };

  const revealAnswer = () => dispatch({ type: "answerRevealed" });

  const gradeCard = (grade: Grade) => {
    if (
      state.status !== "reviewing" ||
      !state.revealed ||
      state.issue === "clock" ||
      state.issue === "conflict"
    )
      return;

    const card = state.reviewSession.cards[state.currentIndex];

    if (!card) return;

    const points = getPointsForGrade(grade);
    const input = {
      id: crypto.randomUUID(),
      cardId: card.id,
      grade,
      reviewedAt: new Date().toISOString(),
    } satisfies ReviewSubmissionInput;

    const submission: ReviewSubmission = {
      input,
      reviewSessionId: state.reviewSession.id,
      card,
      optimisticPoints: points,
      cardIndex: state.currentIndex,
    };

    dispatch({ type: "cardGraded", submission });
    enqueueSubmission(submission, handleRejectedReviewSubmission);
  };

  const repeatForgotten = () => dispatch({ type: "forgottenRepeated" });
  const skipCard = () => dispatch({ type: "cardSkipped" });
  const leaveReviewSession = () => dispatch({ type: "reviewSessionLeft" });
  const updateTutorConversation = (
    update: (messages: TutorConversationMessage[]) => TutorConversationMessage[],
  ) => {
    const attemptKey = getCardAttemptKey(state);

    if (!attemptKey) return;

    setTutorConversation((current) => ({
      attemptKey,
      messages: update(current.attemptKey === attemptKey ? current.messages : []),
    }));
  };

  const value: ReviewSessionContextValue = {
    view: toReviewSessionView(state, tutorConversation),
    startReviewSession,
    revealAnswer,
    gradeCard,
    skipCard,
    repeatForgotten,
    leaveReviewSession,
    updateTutorConversation,
  };

  return <ReviewSessionContext.Provider value={value}>{children}</ReviewSessionContext.Provider>;
}

export function useReviewSession(): ReviewSessionContextValue {
  const value = useContext(ReviewSessionContext);

  if (!value) throw new Error("ReviewSessionProvider missing");

  return value;
}
