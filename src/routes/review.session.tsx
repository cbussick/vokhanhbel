/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- visible Card faces are intentionally keyboard-scrollable regions */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { CardFace } from "../components/audio/CardFace";
import { RequireSession } from "../components/RequireSession";
import { TutorDialog } from "../components/TutorDialog";
import type { Card } from "../contracts/card";
import type { Grade } from "../domain/review";
import { useOnlineStatus } from "../lib/browserState";
import { statsQuery } from "../lib/queries";
import type {
  MatchingEntryView,
  MatchingExerciseView,
  MultipleChoiceOptionView,
} from "../state/ReviewSessionContext";
import { useReviewSession } from "../state/ReviewSessionContext";
import styles from "./reviewSession.module.css";

const confettiColors = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
];
const confettiPieceCount = 24;

interface ConfettiPiece {
  id: number;
  left: string;
  color: string;
  delay: string;
  drift: string;
}

function createConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: confettiPieceCount }, (_, index) => ({
    id: index,
    left: `${Math.round(Math.random() * 100)}%`,
    color: confettiColors[index % confettiColors.length]!,
    delay: `${Math.round(Math.random() * 200)}ms`,
    drift: (Math.random() * 2 - 1).toFixed(2),
  }));
}

/**
 * Hand-rolled rather than pulled from a library: this project has no UI dependencies, and a
 * celebration is not the place to acquire the first one. Hidden from assistive tech, and
 * suppressed entirely under reduced motion by the `.confetti` rule in reviewSession.module.css.
 */
function Confetti() {
  const [pieces] = useState(createConfettiPieces);

  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={styles.confettiPiece}
          // SAFETY: React's CSSProperties type has no slot for a custom property, but
          // `--confetti-drift` is a plain style declaration a browser accepts like any other.
          style={
            {
              left: piece.left,
              background: piece.color,
              animationDelay: piece.delay,
              "--confetti-drift": piece.drift,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export const Route = createFileRoute("/review/session")({ component: ReviewSessionRoute });

function optionClassName(option: MultipleChoiceOptionView): string {
  if (option.revealedCorrect) return `${styles.option} ${styles.optionCorrect}`;
  if (option.dead) return `${styles.option} ${styles.optionDead}`;

  return `${styles.option}`;
}

function TutorButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const { t } = useTranslation();

  return (
    <button type="button" className={styles.tutorButton} onClick={onClick} disabled={disabled}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 2.5c.7 4.5 2.9 6.7 7.4 7.4-4.5.7-6.7 2.9-7.4 7.4-.7-4.5-2.9-6.7-7.4-7.4 4.5-.7 6.7-2.9 7.4-7.4Z" />
        <path
          d="M19 15.5c.35 2.2 1.45 3.3 3.65 3.65-2.2.35-3.3 1.45-3.65 3.65-.35-2.2-1.45-3.3-3.65-3.65 2.2-.35 3.3-1.45 3.65-3.65Z"
          opacity=".65"
        />
      </svg>
      {t("tutor.open")}
    </button>
  );
}

function MultipleChoiceOptions({
  options,
  resolved,
  disabled,
  onChoose,
}: {
  options: MultipleChoiceOptionView[];
  resolved: boolean;
  disabled: boolean;
  onChoose: (optionId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <fieldset className={styles.options} disabled={disabled}>
      <legend className={styles.optionsLegend}>{t("review.multipleChoiceLegend")}</legend>
      <div className={styles.optionsGrid}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={optionClassName(option)}
            disabled={resolved || option.dead}
            onClick={() => onChoose(option.id)}
          >
            {option.text}
            {option.dead && (
              <span className={styles.visuallyHidden}> · {t("review.optionWrong")}</span>
            )}
            {option.revealedCorrect && (
              <span className={styles.visuallyHidden}> · {t("review.optionCorrect")}</span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function MatchingEntryButton({
  entry,
  selected,
  disabled,
  onClick,
}: {
  entry: MatchingEntryView;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const className = entry.matched
    ? `${styles.matchingEntry} ${styles.matchingEntryMatched}`
    : selected
      ? `${styles.matchingEntry} ${styles.matchingEntrySelected}`
      : styles.matchingEntry;

  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {entry.text}
      {entry.matched && (
        <span className={styles.visuallyHidden}> · {t("review.matchingMatched")}</span>
      )}
      {selected && !entry.matched && (
        <span className={styles.visuallyHidden}> · {t("review.matchingSelected")}</span>
      )}
    </button>
  );
}

/**
 * The matching board: rendered as its own top-level branch, separate from the shared flip and
 * multiple-choice render below, so that branch's edits (audio options, VOK-17) never collide with
 * this one. A pair resolves the moment a front and a back are tapped — see
 * `ReviewSessionContext.attemptMatchingPair` — so unlike multiple choice there is no per-Exercise
 * "resolved" state to wait for until every pair on the board has graded.
 */
function MatchingBoardSection({
  view,
  issueKey,
  online,
  selectedFrontCardId,
  mismatchAnnouncement,
  tutorOpen,
  tutorCard,
  onClose,
  onAdvance,
  onSelectFront,
  onAttemptPair,
  onOpenTutor,
  onCloseTutor,
}: {
  view: MatchingExerciseView;
  issueKey: string | undefined;
  online: boolean;
  selectedFrontCardId: string | undefined;
  mismatchAnnouncement: string;
  tutorOpen: boolean;
  tutorCard: Card | undefined;
  onClose: () => void;
  onAdvance: () => void;
  onSelectFront: (cardId: string | undefined) => void;
  onAttemptPair: (frontCardId: string, backCardId: string) => void;
  onOpenTutor: (cardId: string) => void;
  onCloseTutor: () => void;
}) {
  const { t } = useTranslation();
  const reviewSession = useReviewSession();
  const issueBlocksInput = view.issue === "clock" || view.issue === "conflict";

  // A matched entry only responds once the whole board has resolved, and then it opens Tutopher
  // instead of attempting another pair — the Learner has nothing left to match it against.
  const openTutorForMatched = (entry: MatchingEntryView) => {
    if (view.resolved && online) onOpenTutor(entry.cardId);
  };

  const tapFront = (entry: MatchingEntryView) => {
    if (entry.matched) return openTutorForMatched(entry);
    if (!issueBlocksInput) onSelectFront(entry.cardId);
  };

  const tapBack = (entry: MatchingEntryView) => {
    if (entry.matched) return openTutorForMatched(entry);
    if (!issueBlocksInput && selectedFrontCardId) onAttemptPair(selectedFrontCardId, entry.cardId);
  };

  return (
    <RequireSession>
      <AppShell title={t("review.title")} variant="focused">
        <section className={styles.session}>
          <header className={styles.sessionHeader}>
            <button type="button" aria-label={t("review.close")} onClick={onClose}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m5 5 14 14M19 5 5 19" />
              </svg>
            </button>
            <div className={styles.progressWrap}>
              <span aria-hidden="true">
                {view.position} / {view.total}
              </span>
              <progress
                id="review-progress"
                aria-label={t("review.progress", { current: view.position, total: view.total })}
                value={view.position - 1}
                max={view.total}
              />
            </div>
          </header>
          <div className={styles.sessionBody}>
            {issueKey && (
              <p className={styles.issue} role="alert">
                {t(issueKey)}
                {view.issueRequestId && (
                  <span> {t("review.requestId", { requestId: view.issueRequestId })}</span>
                )}
              </p>
            )}
            <p className={styles.optionsLegend}>{t("review.matchingLegend")}</p>
            <div className={styles.matchingBoard}>
              <fieldset className={styles.matchingColumn} disabled={issueBlocksInput}>
                <legend>{t("review.matchingFrontColumn")}</legend>
                {view.front.map((entry) => (
                  <MatchingEntryButton
                    key={entry.cardId}
                    entry={entry}
                    selected={selectedFrontCardId === entry.cardId}
                    disabled={entry.matched && (!view.resolved || !online)}
                    onClick={() => tapFront(entry)}
                  />
                ))}
              </fieldset>
              <fieldset className={styles.matchingColumn} disabled={issueBlocksInput}>
                <legend>{t("review.matchingBackColumn")}</legend>
                {view.back.map((entry) => (
                  <MatchingEntryButton
                    key={entry.cardId}
                    entry={entry}
                    selected={false}
                    disabled={entry.matched && (!view.resolved || !online)}
                    onClick={() => tapBack(entry)}
                  />
                ))}
              </fieldset>
            </div>
            <p className={styles.visuallyHidden} role="status" aria-atomic="true">
              {mismatchAnnouncement}
            </p>
            {view.resolved && (
              <>
                <p className={styles.outcome} role="status">
                  {t("review.matchingResolved")}
                </p>
                <button type="button" className={styles.revealButton} onClick={onAdvance}>
                  {t("review.continue")}
                </button>
              </>
            )}
          </div>
          {tutorOpen && tutorCard && view.resolved && (
            <TutorDialog
              card={tutorCard}
              exercise={view.tutorExercise}
              messages={view.tutorConversation}
              updateMessages={reviewSession.updateTutorConversation}
              onClose={onCloseTutor}
            />
          )}
        </section>
      </AppShell>
    </RequireSession>
  );
}

function ReviewSessionRoute() {
  const { t } = useTranslation();
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
  const [selectedFrontCardId, setSelectedFrontCardId] = useState<string | undefined>(undefined);
  const [matchingMismatch, setMatchingMismatch] = useState("");
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);

  // The summary replaces the Exercise screen in place, so nothing else moves focus there for a
  // screen reader — move it to the heading ourselves, as Dialog and Login do for their own arrivals.
  useEffect(() => {
    if (reviewSession.view.kind === "summary")
      requestAnimationFrame(() => summaryHeadingRef.current?.focus());
  }, [reviewSession.view.kind]);

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
    setSelectedFrontCardId(undefined);
    setMatchingMismatch("");
  };

  const reveal = () => {
    if (reviewSession.view.kind !== "flip" || reviewSession.view.revealed) return;

    reviewSession.revealAnswer();

    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 250;

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

  const issue = reviewSession.view.kind !== "summary" ? reviewSession.view.issue : undefined;
  const issueKey =
    issue === "too-old"
      ? "review.tooOld"
      : issue === "clock"
        ? "review.clock"
        : issue === "deleted"
          ? "review.removed"
          : issue === "conflict"
            ? "review.conflict"
            : undefined;

  if (reviewSession.view.kind === "summary") {
    const currentStreak = stats.data?.currentStreak ?? 0;

    return (
      <RequireSession>
        <AppShell title={t("review.title")}>
          <section className={styles.summary}>
            {reviewSession.view.firstRound && <Confetti />}
            <h2 ref={summaryHeadingRef} tabIndex={-1}>
              {t("review.summary")}
            </h2>
            <dl className={styles.summaryStats}>
              <div>
                <dt>{t("review.summaryReviews")}</dt>
                <dd>{reviewSession.view.cumulativeReviewSubmissions}</dd>
              </div>
              <div>
                <dt>{t("review.summaryPoints")}</dt>
                <dd>{reviewSession.view.cumulativeOptimisticPoints}</dd>
              </div>
              <div>
                <dt>{t("me.streak")}</dt>
                <dd>{currentStreak}</dd>
              </div>
            </dl>
            <div>
              {reviewSession.view.canRepeatForgotten && (
                <button type="button" onClick={reviewSession.repeatForgotten}>
                  {t("review.repeat")}
                </button>
              )}
              <button type="button" onClick={close}>
                {t("common.finish")}
              </button>
            </div>
          </section>
        </AppShell>
      </RequireSession>
    );
  }

  if (reviewSession.view.kind === "matching") {
    return (
      <MatchingBoardSection
        view={reviewSession.view}
        issueKey={issueKey}
        online={online}
        selectedFrontCardId={selectedFrontCardId}
        mismatchAnnouncement={matchingMismatch}
        tutorOpen={tutorOpen}
        tutorCard={reviewSession.view.cards.find(
          (candidate) => candidate.id === tutorSubjectCardId,
        )}
        onClose={close}
        onAdvance={advance}
        onSelectFront={setSelectedFrontCardId}
        onAttemptPair={(frontCardId, backCardId) => {
          reviewSession.attemptMatchingPair(frontCardId, backCardId);
          setSelectedFrontCardId(undefined);
          setMatchingMismatch(frontCardId === backCardId ? "" : t("review.matchingMismatch"));
        }}
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

  const view = reviewSession.view;
  const card = view.currentCard;
  const frontRequiredUnavailable =
    !card.front.text && Boolean(card.front.audio) && !frontAudioAvailable;
  const backRequiredUnavailable =
    view.kind === "flip" &&
    view.revealed &&
    !card.back.text &&
    Boolean(card.back.audio) &&
    !backAudioAvailable;
  const requiredAudioUnavailable = frontRequiredUnavailable || backRequiredUnavailable;

  const tutorButtonDisabled = !online && Boolean(card.front.text) && Boolean(card.back.text);

  return (
    <RequireSession>
      <AppShell title={t("review.title")} variant="focused">
        <section className={styles.session}>
          <header className={styles.sessionHeader}>
            <button type="button" aria-label={t("review.close")} onClick={close}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m5 5 14 14M19 5 5 19" />
              </svg>
            </button>
            <div className={styles.progressWrap}>
              <span aria-hidden="true">
                {view.position} / {view.total}
              </span>
              <progress
                id="review-progress"
                aria-label={t("review.progress", { current: view.position, total: view.total })}
                value={view.position - 1}
                max={view.total}
              />
            </div>
          </header>
          <div className={styles.sessionBody}>
            {issueKey && (
              <p className={styles.issue} role="alert">
                {t(issueKey)}
                {view.issueRequestId && (
                  <span> {t("review.requestId", { requestId: view.issueRequestId })}</span>
                )}
              </p>
            )}
            {view.kind === "flip" ? (
              <>
                <div className={`${styles.reviewCard} ${view.revealed ? styles.revealed : ""}`}>
                  <section
                    className={styles.face}
                    aria-label={t("review.cardFront")}
                    aria-hidden={view.revealed}
                    tabIndex={view.revealed ? -1 : 0}
                  >
                    <CardFace
                      face={card.front}
                      label="front"
                      onAudioAvailabilityChange={setFrontAudioAvailable}
                    />
                  </section>
                  <section
                    className={`${styles.face} ${styles.back}`}
                    aria-label={t("review.cardBack")}
                    aria-hidden={!view.revealed}
                    tabIndex={view.revealed ? 0 : -1}
                  >
                    <CardFace
                      face={card.back}
                      label="back"
                      onAudioAvailabilityChange={setBackAudioAvailable}
                    />
                  </section>
                </div>
                {!view.revealed && (
                  <button
                    type="button"
                    className={styles.revealButton}
                    onClick={reveal}
                    disabled={frontRequiredUnavailable}
                  >
                    {t("review.reveal")}
                  </button>
                )}
                {view.revealed && revealComplete && (
                  <>
                    <TutorButton
                      onClick={() => setTutorOpen(true)}
                      disabled={tutorButtonDisabled}
                    />
                    <fieldset
                      className={styles.grades}
                      disabled={
                        backRequiredUnavailable ||
                        view.issue === "clock" ||
                        view.issue === "conflict"
                      }
                    >
                      <legend>{t("review.grading")}</legend>
                      <button type="button" onClick={() => grade("forgot")}>
                        {t("review.forgot")}
                      </button>
                      <button type="button" onClick={() => grade("almost")}>
                        {t("review.almost")}
                      </button>
                      <button type="button" onClick={() => grade("knew_it")}>
                        {t("review.knewIt")}
                      </button>
                    </fieldset>
                  </>
                )}
              </>
            ) : (
              <>
                <div className={styles.promptFace}>
                  <CardFace
                    face={card.front}
                    label="front"
                    onAudioAvailabilityChange={setFrontAudioAvailable}
                  />
                </div>
                <MultipleChoiceOptions
                  options={view.options}
                  resolved={view.resolved}
                  disabled={
                    frontRequiredUnavailable || view.issue === "clock" || view.issue === "conflict"
                  }
                  onChoose={reviewSession.chooseOption}
                />
                {view.resolved && (
                  <>
                    <p className={styles.outcome} role="status">
                      {t(view.correct ? "review.answerCorrect" : "review.answerWrong")}
                    </p>
                    <TutorButton
                      onClick={() => setTutorOpen(true)}
                      disabled={tutorButtonDisabled}
                    />
                    <button type="button" className={styles.revealButton} onClick={advance}>
                      {t("review.continue")}
                    </button>
                  </>
                )}
              </>
            )}
            {requiredAudioUnavailable && (
              <div className={styles.audioUnavailable} role="alert">
                <p>{t("review.audioRequiredUnavailable")}</p>
                <button type="button" onClick={skip}>
                  {t("review.skipCard")}
                </button>
              </div>
            )}
          </div>
          {tutorOpen && (view.kind === "flip" || view.resolved) && (
            <TutorDialog
              card={card}
              exercise={view.tutorExercise}
              messages={view.tutorConversation}
              updateMessages={reviewSession.updateTutorConversation}
              onClose={() => setTutorOpen(false)}
            />
          )}
        </section>
      </AppShell>
    </RequireSession>
  );
}
