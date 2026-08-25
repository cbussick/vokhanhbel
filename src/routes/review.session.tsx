/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- visible Card faces are intentionally keyboard-scrollable regions */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { AudioPlayer } from "../components/audio/AudioPlayer";
import { CardFace } from "../components/audio/CardFace";
import { RequireSession } from "../components/RequireSession";
import { TutorDialog } from "../components/TutorDialog";
import type { Grade } from "../domain/review";
import { useOnlineStatus } from "../lib/browserState";
import { statsQuery } from "../lib/queries";
import type { MultipleChoiceOptionView } from "../state/ReviewSessionContext";
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

function optionModifierClassName(option: MultipleChoiceOptionView): string {
  if (option.revealedCorrect) return styles.optionCorrect ?? "";
  if (option.dead) return styles.optionDead ?? "";

  return "";
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

function OptionOutcome({ option }: { option: MultipleChoiceOptionView }) {
  const { t } = useTranslation();

  return (
    <>
      {option.dead && <span className={styles.visuallyHidden}> · {t("review.optionWrong")}</span>}
      {option.revealedCorrect && (
        <span className={styles.visuallyHidden}> · {t("review.optionCorrect")}</span>
      )}
    </>
  );
}

/**
 * An audio option is a play control plus a separate "choose" button rather than one clickable
 * button, because AudioPlayer's own play/pause/retry control must keep working — including the
 * retry a Learner needs precisely while `audioUnavailable` blocks every choose button — regardless
 * of whether grading is currently blocked.
 */
function MultipleChoiceOptions({
  options,
  resolved,
  disabled,
  audioUnavailable,
  onOptionAvailabilityChange,
  onChoose,
}: {
  options: MultipleChoiceOptionView[];
  resolved: boolean;
  disabled: boolean;
  audioUnavailable: boolean;
  onOptionAvailabilityChange: (optionId: string, available: boolean) => void;
  onChoose: (optionId: string) => void;
}) {
  const { t } = useTranslation();
  const audioMode = options.some((option) => option.audio);

  return (
    <fieldset className={styles.options} disabled={disabled}>
      <legend className={styles.optionsLegend}>
        {t(audioMode ? "review.multipleChoiceAudioLegend" : "review.multipleChoiceLegend")}
      </legend>
      <div className={styles.optionsGrid}>
        {options.map((option, index) =>
          option.audio ? (
            <div
              key={option.id}
              className={`${styles.audioOption} ${optionModifierClassName(option)}`}
            >
              <AudioPlayer
                audio={option.audio}
                label={t("review.audioOptionLabel", { index: index + 1 })}
                compact
                onAvailabilityChange={(available) =>
                  onOptionAvailabilityChange(option.id, available)
                }
              />
              <button
                type="button"
                className={styles.chooseOption}
                disabled={resolved || option.dead || audioUnavailable}
                onClick={() => onChoose(option.id)}
              >
                {t("review.chooseOption", { index: index + 1 })}
                <OptionOutcome option={option} />
              </button>
            </div>
          ) : (
            <button
              key={option.id}
              type="button"
              className={`${styles.option} ${optionModifierClassName(option)}`}
              disabled={resolved || option.dead}
              onClick={() => onChoose(option.id)}
            >
              {option.text}
              <OptionOutcome option={option} />
            </button>
          ),
        )}
      </div>
    </fieldset>
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
  const [revealComplete, setRevealComplete] = useState(false);
  const [frontAudioAvailable, setFrontAudioAvailable] = useState(true);
  const [backAudioAvailable, setBackAudioAvailable] = useState(true);
  const [unavailableOptionIds, setUnavailableOptionIds] = useState<ReadonlySet<string>>(new Set());
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

    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 250;

    window.setTimeout(() => setRevealComplete(true), duration);
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
  // While any audio option has failed to load, guessing between the ones the Learner can still hear
  // would record a Grade she never gave — so grading stays blocked until every option recovers.
  const optionsAudioUnavailable =
    view.kind === "multipleChoice" && !view.resolved && unavailableOptionIds.size > 0;
  const requiredAudioUnavailable =
    frontRequiredUnavailable || backRequiredUnavailable || optionsAudioUnavailable;

  const tutorButtonDisabled = !online && Boolean(card.front.text) && Boolean(card.back.text);

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
                  audioUnavailable={optionsAudioUnavailable}
                  onOptionAvailabilityChange={setOptionAvailability}
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
