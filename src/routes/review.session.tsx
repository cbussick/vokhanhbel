/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- visible Card faces are intentionally keyboard-scrollable regions */
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { CardFace } from "../components/audio/CardFace";
import { RequireSession } from "../components/RequireSession";
import { TutorDialog } from "../components/TutorDialog";
import type { Grade } from "../domain/review";
import { useOnlineStatus } from "../lib/browserState";
import type { MultipleChoiceOptionView } from "../state/ReviewSessionContext";
import { useReviewSession } from "../state/ReviewSessionContext";
import styles from "./reviewSession.module.css";

export const Route = createFileRoute("/review/session")({ component: ReviewSessionRoute });

function optionClassName(option: MultipleChoiceOptionView): string {
  if (option.revealedCorrect) return `${styles.option} ${styles.optionCorrect}`;
  if (option.dead) return `${styles.option} ${styles.optionDead}`;

  return `${styles.option}`;
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

function ReviewSessionRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reviewSession = useReviewSession();
  const online = useOnlineStatus();
  const [tutorOpen, setTutorOpen] = useState(false);
  const [revealComplete, setRevealComplete] = useState(false);
  const [frontAudioAvailable, setFrontAudioAvailable] = useState(true);
  const [backAudioAvailable, setBackAudioAvailable] = useState(true);

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
    return (
      <RequireSession>
        <AppShell title={t("review.title")}>
          <section className={styles.summary}>
            {reviewSession.view.firstRound && (
              <div className={styles.confetti} aria-hidden="true">
                ✦ · ✦ · ✦
              </div>
            )}
            <h2>{t("review.summary")}</h2>
            <p>
              {t("review.summaryText", {
                reviews: reviewSession.view.cumulativeReviewSubmissions,
                points: reviewSession.view.cumulativeOptimisticPoints,
              })}
            </p>
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
  const requiredAudioUnavailable = frontRequiredUnavailable || backRequiredUnavailable;

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
                    <button
                      type="button"
                      className={styles.tutorButton}
                      onClick={() => setTutorOpen(true)}
                      disabled={!online && Boolean(card.front.text) && Boolean(card.back.text)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M12 2.5c.7 4.5 2.9 6.7 7.4 7.4-4.5.7-6.7 2.9-7.4 7.4-.7-4.5-2.9-6.7-7.4-7.4 4.5-.7 6.7-2.9 7.4-7.4Z" />
                        <path
                          d="M19 15.5c.35 2.2 1.45 3.3 3.65 3.65-2.2.35-3.3 1.45-3.65 3.65-.35-2.2-1.45-3.3-3.65-3.65 2.2-.35 3.3-1.45 3.65-3.65Z"
                          opacity=".65"
                        />
                      </svg>
                      {t("tutor.open")}
                    </button>
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
          {tutorOpen && view.kind === "flip" && (
            <TutorDialog
              card={card}
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
