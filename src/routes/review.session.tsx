import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FlipCardExercise } from "../components/review/FlipCardExercise";
import { MatchingExercise } from "../components/review/MatchingExercise";
import { MultipleChoiceExercise } from "../components/review/MultipleChoiceExercise";
import { SessionSummary } from "../components/review/SessionSummary";
import { SwipeExercise } from "../components/review/SwipeExercise";
import type { Grade } from "../domain/review";
import { prefersReducedMotion, useOnlineStatus } from "../lib/browserState";
import { statsQuery } from "../lib/queries";
import { useReviewSession } from "../state/ReviewSessionContext";

export const Route = createFileRoute("/review/session")({ component: ReviewSessionRoute });

const issueKeysByIssue = {
  "too-old": "review.tooOld",
  clock: "review.clock",
  deleted: "review.removed",
  conflict: "review.conflict",
} as const;

/**
 * Dispatches the Review Session's current view to the Exercise that renders it. The screen chrome
 * lives in `ExerciseScreen`, and each Exercise owns its own body — this route holds only the state
 * the Exercises share and the handlers that reset it as the Session advances.
 */
function ReviewSessionRoute() {
  const navigate = useNavigate();
  const reviewSession = useReviewSession();
  const online = useOnlineStatus();
  // Read the Streak from the same query "Ich" reads, so the two never diverge (see ADR-0008).
  const stats = useQuery(statsQuery);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorSubjectCardId, setTutorSubjectCardId] = useState<string | undefined>(undefined);
  const [revealComplete, setRevealComplete] = useState(false);
  const [frontAudioAvailable, setFrontAudioAvailable] = useState(true);
  const [backAudioAvailable, setBackAudioAvailable] = useState(true);
  const [unavailableOptionIds, setUnavailableOptionIds] = useState<ReadonlySet<string>>(new Set());

  if (reviewSession.view.kind === "idle") return <Navigate to="/review" />;

  const close = () => {
    reviewSession.leaveReviewSession();
    void navigate({ to: "/review" });
  };

  const resetFaceState = () => {
    setRevealComplete(false);
    setTutorOpen(false);
    setTutorSubjectCardId(undefined);
    setFrontAudioAvailable(true);
    setBackAudioAvailable(true);
    setUnavailableOptionIds(new Set());
  };

  const setOptionAvailability = (optionId: string, available: boolean) => {
    setUnavailableOptionIds((current) => {
      const next = new Set(current);

      if (available) next.delete(optionId);
      else next.add(optionId);

      return next;
    });
  };

  const reveal = () => {
    if (reviewSession.view.kind !== "flip" || reviewSession.view.revealed) return;

    reviewSession.revealAnswer();

    const duration = prefersReducedMotion() ? 120 : 250;

    window.setTimeout(() => setRevealComplete(true), duration);
  };

  const grade = (value: Grade) => {
    reviewSession.gradeCard(value);
    resetFaceState();
  };

  const advance = () => {
    reviewSession.advanceExercise();
    resetFaceState();
  };

  const skip = () => {
    reviewSession.skipCard();
    resetFaceState();
  };

  if (reviewSession.view.kind === "summary") {
    return (
      <SessionSummary
        view={reviewSession.view}
        currentStreak={stats.data?.currentStreak ?? 0}
        onRepeatForgotten={reviewSession.repeatForgotten}
        onFinish={close}
      />
    );
  }

  const view = reviewSession.view;
  const issueKey = view.issue ? issueKeysByIssue[view.issue] : undefined;

  if (view.kind === "matching") {
    return (
      <MatchingExercise
        view={view}
        issueKey={issueKey}
        online={online}
        tutorOpen={tutorOpen}
        tutorCard={view.cards.find((candidate) => candidate.id === tutorSubjectCardId)}
        onClose={close}
        onAdvance={advance}
        onOpenTutor={(cardId) => {
          setTutorSubjectCardId(cardId);
          setTutorOpen(true);
        }}
        onCloseTutor={() => {
          setTutorOpen(false);
          setTutorSubjectCardId(undefined);
        }}
      />
    );
  }

  const card = view.currentCard;
  const tutorDisabled = !online && Boolean(card.front.text) && Boolean(card.back.text);

  if (view.kind === "swipe") {
    return (
      <SwipeExercise
        view={view}
        issueKey={issueKey}
        tutorOpen={tutorOpen}
        tutorDisabled={tutorDisabled}
        onClose={close}
        onChoose={reviewSession.chooseSwipeOption}
        onAdvance={advance}
        onOpenTutor={() => setTutorOpen(true)}
        onCloseTutor={() => setTutorOpen(false)}
      />
    );
  }

  if (view.kind === "multipleChoice") {
    return (
      <MultipleChoiceExercise
        view={view}
        issueKey={issueKey}
        frontAudioAvailable={frontAudioAvailable}
        unavailableOptionIds={unavailableOptionIds}
        tutorOpen={tutorOpen}
        tutorDisabled={tutorDisabled}
        onClose={close}
        onAdvance={advance}
        onSkip={skip}
        onFrontAudioAvailabilityChange={setFrontAudioAvailable}
        onOptionAvailabilityChange={setOptionAvailability}
        onOpenTutor={() => setTutorOpen(true)}
        onCloseTutor={() => setTutorOpen(false)}
      />
    );
  }

  return (
    <FlipCardExercise
      view={view}
      issueKey={issueKey}
      revealComplete={revealComplete}
      frontAudioAvailable={frontAudioAvailable}
      backAudioAvailable={backAudioAvailable}
      tutorOpen={tutorOpen}
      tutorDisabled={tutorDisabled}
      onClose={close}
      onReveal={reveal}
      onGrade={grade}
      onSkip={skip}
      onFrontAudioAvailabilityChange={setFrontAudioAvailable}
      onBackAudioAvailabilityChange={setBackAudioAvailable}
      onOpenTutor={() => setTutorOpen(true)}
      onCloseTutor={() => setTutorOpen(false)}
    />
  );
}
