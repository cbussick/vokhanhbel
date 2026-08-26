import { createContext, type ReactNode, useContext, useReducer, useState } from "react";
import { apiPaths } from "../contracts/apiPaths";
import type { AudioMetadata, Card } from "../contracts/card";
import { problemTypes } from "../contracts/problem";
import type { ReviewSubmissionInput } from "../contracts/review";
import { leadingGroupedExerciseKind, planExercises } from "../domain/exercisePlanner";
import type { GroupedExerciseKind, PlannedExercise } from "../domain/exercisePlanner";
import type { Grade } from "../domain/review";
import { getPointsForGrade, reviewSessionSize } from "../domain/review";
import { ApiError } from "../lib/apiClient";
import { getLastGroupedExerciseKind, setLastGroupedExerciseKind } from "../lib/browserState";
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

export interface FlipExerciseView {
  kind: "flip";
  currentCard: Card;
  position: number;
  total: number;
  revealed: boolean;
  issue: ReviewSubmissionIssue | undefined;
  issueRequestId: string | undefined;
  tutorConversation: TutorConversationMessage[];
  tutorExercise: TutorExerciseContext;
}

export interface MatchingEntryView {
  cardId: string;
  text: string;
  /** True once this entry's Card has been correctly matched — shown resolved and, once the whole
   * board is `resolved`, tappable to open Tutopher for it instead of attempting another pair. */
  matched: boolean;
}

export interface MatchingExerciseView {
  kind: "matching";
  position: number;
  total: number;
  /** The board's Cards, for looking up the one a resolved tap opens Tutopher for. */
  cards: Card[];
  /** Front-column entries, in the planned shuffled order. */
  front: MatchingEntryView[];
  /** Back-column entries, shuffled independently of `front`. */
  back: MatchingEntryView[];
  /** True once every Card on the board has graded — the board stays up, and tapping any pair now
   * opens Tutopher for it instead of attempting another match. */
  resolved: boolean;
  issue: ReviewSubmissionIssue | undefined;
  issueRequestId: string | undefined;
  tutorConversation: TutorConversationMessage[];
  tutorExercise: TutorExerciseContext;
}

export interface MultipleChoiceOptionView {
  id: string;
  /** Exactly one is set, matching every other option's modality in the same Exercise. */
  text: string | null;
  audio: AudioMetadata | null;
  /** Answered wrong already: shown red and unselectable, whether or not the Exercise has resolved. */
  dead: boolean;
  /** The right answer, shown green — never true before the Exercise has resolved. */
  revealedCorrect: boolean;
}

export interface MultipleChoiceExerciseView {
  kind: "multipleChoice";
  currentCard: Card;
  position: number;
  total: number;
  options: MultipleChoiceOptionView[];
  resolved: boolean;
  /** Whether the final verdict was correct — only meaningful once `resolved` is true. */
  correct: boolean;
  issue: ReviewSubmissionIssue | undefined;
  issueRequestId: string | undefined;
  tutorConversation: TutorConversationMessage[];
  tutorExercise: TutorExerciseContext;
}

export interface SwipeOptionView {
  /** The id of the Card whose back supplied this option — the swiped Card itself when `correct`. */
  cardId: string;
  text: string;
  correct: boolean;
}

/** One Card thrown into one of two buckets — the whole Exercise, not a position within a deck. */
export interface SwipeExerciseView {
  kind: "swipe";
  position: number;
  total: number;
  currentCard: Card;
  /** The Card's two options, left first — exactly one has `correct: true`. */
  options: SwipeOptionView[];
  /** True once the Card has been swiped or tapped; the Session advances past it only on "Weiter",
   * the same pause every other Exercise in this app gives before moving on. */
  resolved: boolean;
  /** Whether the final verdict was correct — only meaningful once `resolved` is true. */
  correct: boolean;
  issue: ReviewSubmissionIssue | undefined;
  issueRequestId: string | undefined;
  tutorConversation: TutorConversationMessage[];
  tutorExercise: TutorExerciseContext;
}

export interface SummaryView {
  kind: "summary";
  cumulativeReviewSubmissions: number;
  cumulativeOptimisticPoints: number;
  firstRound: boolean;
  canRepeatForgotten: boolean;
}

export type ReviewSessionView =
  | IdleView
  | FlipExerciseView
  | MultipleChoiceExerciseView
  | MatchingExerciseView
  | SwipeExerciseView
  | SummaryView;

export interface TutorConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The resolved Exercise as the Tutor request describes it: every Card it covered with the Grade
 * each resolved to (null for a flip Card's self-graded outcome), and the option text the Learner
 * chose (null for a flip Card, which has none). Mirrors `TutorInput`'s exercise fields.
 */
export interface TutorExerciseContext {
  cards: { cardId: string; outcome: Grade | null }[];
  chosenOptionText: string | null;
}

interface ReviewSessionContextValue {
  view: ReviewSessionView;
  startReviewSession: (dueCards: Card[], pool: Card[]) => void;
  revealAnswer: () => void;
  gradeCard: (grade: Grade) => void;
  chooseOption: (optionId: string) => void;
  /** Attempts pairing the tapped front Card against the tapped back Card; a mismatch taints both
   * without grading either, a match grades the Card `knew_it` or `almost` and enqueues its Review
   * Submission immediately — see the reducer's `matchingPairResolved` for why immediately. */
  attemptMatchingPair: (frontCardId: string, backCardId: string) => void;
  /** Commits the Swipe Card into the bucket with this id — by drag or by tap, both call this the
   * same way. Grades `knew_it` or `forgot` and holds on the resolution until `advanceExercise`. */
  chooseSwipeOption: (optionCardId: string) => void;
  advanceExercise: () => void;
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

function getExerciseAttemptKey(state: ReviewSessionState): string | undefined {
  if (state.status !== "reviewing") return undefined;

  return `${state.reviewSession.id}:${state.reviewSession.exerciseAttemptNumber}`;
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

  const exercise = state.reviewSession.exercises[state.currentIndex];
  const currentCard = exercise?.cards[0];

  if (!exercise || !currentCard) return { kind: "idle" };

  const position = state.currentIndex + 1;
  const total = state.reviewSession.exercises.length;
  const conversation =
    tutorConversation.attemptKey === getExerciseAttemptKey(state) ? tutorConversation.messages : [];

  if (exercise.kind === "flip") {
    return {
      kind: "flip",
      currentCard,
      position,
      total,
      revealed: state.revealed,
      issue: state.issue,
      issueRequestId: state.issueRequestId,
      tutorConversation: conversation,
      tutorExercise: { cards: [{ cardId: currentCard.id, outcome: null }], chosenOptionText: null },
    };
  }

  if (exercise.kind === "matching") {
    const resolvedCardIds = new Set(state.matching?.resolvedCardIds ?? []);
    const cardsById = new Map(
      exercise.cards.map((matchingCard) => [matchingCard.id, matchingCard]),
    );
    const toEntry = (cardId: string, face: "front" | "back"): MatchingEntryView | undefined => {
      const matchingCard = cardsById.get(cardId);
      const faceText = matchingCard?.[face].text;

      return faceText
        ? { cardId, text: faceText, matched: resolvedCardIds.has(cardId) }
        : undefined;
    };
    const toEntries = (order: string[], face: "front" | "back") =>
      order
        .map((cardId) => toEntry(cardId, face))
        .filter((entry): entry is MatchingEntryView => entry !== undefined);

    return {
      kind: "matching",
      position,
      total,
      cards: exercise.cards,
      front: toEntries(exercise.frontOrder, "front"),
      back: toEntries(exercise.backOrder, "back"),
      resolved: exercise.cards.length > 0 && resolvedCardIds.size === exercise.cards.length,
      issue: state.issue,
      issueRequestId: state.issueRequestId,
      tutorConversation: conversation,
      tutorExercise: {
        cards: exercise.cards.map((matchingCard) => ({
          cardId: matchingCard.id,
          outcome:
            state.reviewSession.roundSubmissions.find(
              (submission) => submission.card.id === matchingCard.id,
            )?.input.grade ?? null,
        })),
        chosenOptionText: null,
      },
    };
  }

  if (exercise.kind === "swipe") {
    const swipe = state.swipe;
    // The correct option's own text when the resolved pick was correct; otherwise the only other
    // (necessarily wrong) option's text — Swipe has just two, so which was chosen never needs its
    // own field, the way `MultipleChoiceProgress.resolvedOptionId` needs one for four candidates.
    const chosenOptionText = swipe
      ? (exercise.options.find((option) => option.correct === swipe.correct)?.text ?? null)
      : null;

    return {
      kind: "swipe",
      position,
      total,
      currentCard,
      options: exercise.options.map((option) => ({
        cardId: option.cardId,
        text: option.text,
        correct: option.correct,
      })),
      resolved: swipe !== undefined,
      correct: swipe?.correct ?? false,
      issue: state.issue,
      issueRequestId: state.issueRequestId,
      tutorConversation: conversation,
      tutorExercise: {
        cards: [
          {
            cardId: currentCard.id,
            outcome: swipe ? (swipe.correct ? "knew_it" : "forgot") : null,
          },
        ],
        chosenOptionText,
      },
    };
  }

  const deadOptionIds = state.multipleChoice?.deadOptionIds ?? [];
  const resolvedSubmission = state.multipleChoice?.resolvedSubmission;
  const chosenOption = exercise.options.find(
    (option) => option.cardId === state.multipleChoice?.resolvedOptionId,
  );

  return {
    kind: "multipleChoice",
    currentCard,
    position,
    total,
    resolved: Boolean(resolvedSubmission),
    correct: resolvedSubmission?.input.grade !== "forgot",
    options: exercise.options.map((option) => ({
      id: option.cardId,
      text: option.text,
      audio: option.audio,
      dead: deadOptionIds.includes(option.cardId),
      revealedCorrect: Boolean(resolvedSubmission) && option.correct,
    })),
    issue: state.issue,
    issueRequestId: state.issueRequestId,
    tutorConversation: conversation,
    tutorExercise: {
      cards: [{ cardId: currentCard.id, outcome: resolvedSubmission?.input.grade ?? null }],
      chosenOptionText: chosenOption?.text ?? null,
    },
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

  const startReviewSession = (dueCards: Card[], pool: Card[]) => {
    const initialQueue = dueCards.slice(0, reviewSessionSize);

    if (initialQueue.length === 0) return;

    const previousGroupedKind = getLastGroupedExerciseKind();
    const exercises = planExercises(initialQueue, pool, Math.random, previousGroupedKind);
    // The grouped kind this Session actually planned becomes next Session's preference — see
    // `groupedExerciseOrder` in exercisePlanner.ts for how the alternation reads it back. When it
    // planned none, the kind that merely led the attempt is remembered instead, so a Sammlung that
    // can never assemble a matching board still alternates round to Swipe's turn rather than
    // leading with matching every Session and never reaching it.
    const groupedKind = exercises.find(
      (exercise): exercise is Extract<PlannedExercise, { kind: GroupedExerciseKind }> =>
        exercise.kind === "matching" || exercise.kind === "swipe",
    )?.kind;

    setLastGroupedExerciseKind(groupedKind ?? leadingGroupedExerciseKind(previousGroupedKind));

    dispatch({
      type: "reviewSessionStarted",
      reviewSessionId: crypto.randomUUID(),
      exercises,
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

    const exercise = state.reviewSession.exercises[state.currentIndex];

    if (!exercise || exercise.kind !== "flip") return;

    const card = exercise.cards[0];

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
      exerciseIndex: state.currentIndex,
    };

    dispatch({ type: "cardGraded", submission });
    enqueueSubmission(submission, handleRejectedReviewSubmission);
  };

  const chooseOption = (optionId: string) => {
    if (state.status !== "reviewing" || state.issue === "clock" || state.issue === "conflict")
      return;

    const exercise = state.reviewSession.exercises[state.currentIndex];

    if (!exercise || exercise.kind !== "multipleChoice") return;

    const deadOptionIds = state.multipleChoice?.deadOptionIds ?? [];

    if (state.multipleChoice?.resolvedSubmission || deadOptionIds.includes(optionId)) return;

    const option = exercise.options.find((candidate) => candidate.cardId === optionId);
    const card = exercise.cards[0];

    if (!option || !card) return;

    // A first wrong pick just knocks the option out and re-asks; the Exercise stays open.
    if (!option.correct && deadOptionIds.length === 0) {
      dispatch({ type: "multipleChoiceOptionMissed", optionId });

      return;
    }

    const grade: Grade = option.correct
      ? deadOptionIds.length === 0
        ? "knew_it"
        : "almost"
      : "forgot";
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
      exerciseIndex: state.currentIndex,
    };

    dispatch({ type: "multipleChoiceResolved", optionId, correct: option.correct, submission });
    enqueueSubmission(submission, handleRejectedReviewSubmission);
  };

  const attemptMatchingPair = (frontCardId: string, backCardId: string) => {
    if (state.status !== "reviewing" || state.issue === "clock" || state.issue === "conflict")
      return;

    const exercise = state.reviewSession.exercises[state.currentIndex];

    if (!exercise || exercise.kind !== "matching") return;

    const resolvedCardIds = state.matching?.resolvedCardIds ?? [];

    if (resolvedCardIds.includes(frontCardId) || resolvedCardIds.includes(backCardId)) return;

    // Front and back entries both carry the id of the Card they belong to, so a pair is correct
    // exactly when the two tapped ids are the same Card's — no text comparison needed.
    if (frontCardId !== backCardId) {
      dispatch({ type: "matchingPairMismatched", cardIds: [frontCardId, backCardId] });

      return;
    }

    const card = exercise.cards.find((candidate) => candidate.id === frontCardId);

    if (!card) return;

    const taintedCardIds = state.matching?.taintedCardIds ?? [];
    const grade: Grade = taintedCardIds.includes(frontCardId) ? "almost" : "knew_it";
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
      exerciseIndex: state.currentIndex,
    };

    dispatch({ type: "matchingPairResolved", submission });
    enqueueSubmission(submission, handleRejectedReviewSubmission);
  };

  const chooseSwipeOption = (optionCardId: string) => {
    if (state.status !== "reviewing" || state.issue === "clock" || state.issue === "conflict")
      return;

    const exercise = state.reviewSession.exercises[state.currentIndex];

    if (!exercise || exercise.kind !== "swipe") return;

    // The resolution is still on screen — Swipe has no retry, so nothing more can be committed.
    if (state.swipe) return;

    const option = exercise.options.find((candidate) => candidate.cardId === optionCardId);
    const card = exercise.cards[0];

    if (!option || !card) return;

    // Two options mean no meaningful retry, so Swipe is the one binary Exercise (ADR-0014).
    const grade: Grade = option.correct ? "knew_it" : "forgot";
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
      exerciseIndex: state.currentIndex,
    };

    dispatch({ type: "swipeCardResolved", correct: option.correct, submission });
    enqueueSubmission(submission, handleRejectedReviewSubmission);
  };

  const advanceExercise = () => dispatch({ type: "exerciseAdvanced" });
  const repeatForgotten = () => dispatch({ type: "forgottenRepeated" });
  const skipCard = () => dispatch({ type: "cardSkipped" });
  const leaveReviewSession = () => dispatch({ type: "reviewSessionLeft" });
  const updateTutorConversation = (
    update: (messages: TutorConversationMessage[]) => TutorConversationMessage[],
  ) => {
    const attemptKey = getExerciseAttemptKey(state);

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
    chooseOption,
    attemptMatchingPair,
    chooseSwipeOption,
    advanceExercise,
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
