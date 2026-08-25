import { createContext, type ReactNode, useContext, useReducer, useState } from "react";
import { apiPaths } from "../contracts/apiPaths";
import type { AudioMetadata, Card } from "../contracts/card";
import { problemTypes } from "../contracts/problem";
import type { ReviewSubmissionInput } from "../contracts/review";
import { planExercises } from "../domain/exercisePlanner";
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

interface FlipExerciseView {
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

interface MultipleChoiceExerciseView {
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

/**
 * One Card in the Swipe deck, in the position `currentCard` occupies whenever this view's `kind` is
 * `"swipe"` — the deck's shrink-on-rejection floor (`shrinkSwipeDeck`) never lets it fall to zero
 * Cards while the Exercise itself still exists, so a card here is never undefined.
 */
export interface SwipeExerciseView {
  kind: "swipe";
  position: number;
  total: number;
  /** The deck's Cards, in stacked presentation order — for rendering the Cards still waiting behind
   * `currentCard`. */
  cards: Card[];
  currentCard: Card;
  /** `currentCard`'s two options, left first — exactly one has `correct: true`. */
  options: SwipeOptionView[];
  /** True once `currentCard` has been swiped or tapped; the Session advances past it only on
   * "Weiter", the same pause every other Exercise in this app gives before moving on. */
  resolved: boolean;
  /** Whether the final verdict was correct — only meaningful once `resolved` is true. */
  correct: boolean;
  /** True when `currentCard` is the last Card left in the deck — "Weiter" here leaves the whole
   * Exercise rather than only moving to the next Card. */
  isLastCard: boolean;
  issue: ReviewSubmissionIssue | undefined;
  issueRequestId: string | undefined;
  tutorConversation: TutorConversationMessage[];
  tutorExercise: TutorExerciseContext;
}

interface SummaryView {
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
  /** Commits the current deck Card onto the option with this id — by drag or by tap, both call this
   * the same way. Grades `knew_it` or `forgot` and pauses the deck on the resolution, correct or
   * wrong, until `continueSwipeCard`. */
  chooseSwipeOption: (optionCardId: string) => void;
  /** Dismisses the current Card's resolution, moving the deck to the next Card. */
  continueSwipeCard: () => void;
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
    const resolvedEntries = state.swipe?.resolved ?? [];
    const resolvedByCardId = new Map(resolvedEntries.map((entry) => [entry.cardId, entry]));
    const awaitingContinueCardId = state.swipe?.awaitingContinueCardId;
    // While a resolution is on screen, the "current" Card stays the one just graded until Weiter;
    // otherwise it's whichever Card in the deck hasn't resolved yet. `shrinkSwipeDeck` never lets
    // the deck reach zero Cards while the Exercise itself still exists, so one is always found.
    const currentCardId = awaitingContinueCardId ?? exercise.deck[resolvedEntries.length]!.cardId;
    const currentSwipeCard = exercise.cards.find((swiped) => swiped.id === currentCardId)!;
    const currentDeckEntry = exercise.deck.find((entry) => entry.cardId === currentCardId)!;
    const resolvedEntry = resolvedByCardId.get(currentCardId);
    // The correct option's own text when the resolved pick was correct; otherwise the only other
    // (necessarily wrong) option's text — Swipe has just two, so which was chosen never needs its
    // own field, the way `MultipleChoiceProgress.resolvedOptionId` needs one for four candidates.
    const chosenOptionText = resolvedEntry
      ? (currentDeckEntry.options.find((option) => option.correct === resolvedEntry.correct)
          ?.text ?? null)
      : null;

    return {
      kind: "swipe",
      position,
      total,
      cards: exercise.cards,
      currentCard: currentSwipeCard,
      options: currentDeckEntry.options.map((option) => ({
        cardId: option.cardId,
        text: option.text,
        correct: option.correct,
      })),
      resolved: Boolean(resolvedEntry),
      correct: resolvedEntry?.correct ?? false,
      isLastCard: exercise.cards[exercise.cards.length - 1]?.id === currentCardId,
      issue: state.issue,
      issueRequestId: state.issueRequestId,
      tutorConversation: conversation,
      tutorExercise: {
        cards: exercise.cards.map((swiped) => ({
          cardId: swiped.id,
          outcome: resolvedByCardId.has(swiped.id)
            ? resolvedByCardId.get(swiped.id)!.correct
              ? "knew_it"
              : "forgot"
            : null,
        })),
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

    const exercises = planExercises(initialQueue, pool, Math.random, getLastGroupedExerciseKind());
    // The grouped kind this Session actually planned (if any) becomes next Session's preference —
    // see `groupedExerciseOrder` in exercisePlanner.ts for how the alternation reads it back.
    const groupedKind = exercises.find(
      (exercise): exercise is Extract<PlannedExercise, { kind: GroupedExerciseKind }> =>
        exercise.kind === "matching" || exercise.kind === "swipe",
    )?.kind;

    if (groupedKind) setLastGroupedExerciseKind(groupedKind);

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

    // A resolution is still on screen — the Learner needs to continue past it before the next
    // Card in the deck can be swiped.
    if (state.swipe?.awaitingContinueCardId) return;

    const resolvedCount = state.swipe?.resolved.length ?? 0;
    const currentDeckEntry = exercise.deck[resolvedCount];

    if (!currentDeckEntry) return;

    const option = currentDeckEntry.options.find((candidate) => candidate.cardId === optionCardId);
    const card = exercise.cards.find((candidate) => candidate.id === currentDeckEntry.cardId);

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

  const continueSwipeCard = () => dispatch({ type: "swipeCardAdvanced" });

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
    continueSwipeCard,
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
