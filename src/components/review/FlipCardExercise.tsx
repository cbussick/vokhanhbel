/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- visible Card faces are intentionally keyboard-scrollable regions */
import { useTranslation } from "react-i18next";
import type { Grade } from "../../domain/review";
import type { FlipExerciseView } from "../../state/ReviewSessionContext";
import { useReviewSession } from "../../state/ReviewSessionContext";
import { CardFace } from "../audio/CardFace";
import { TutorDialog } from "../TutorDialog";
import { AudioUnavailableNotice } from "./AudioUnavailableNotice";
import { ExerciseScreen } from "./ExerciseScreen";
import { TutorButton } from "./TutorButton";
import styles from "./reviewSession.module.css";

/** The self-graded Exercise: the Card the Learner turns over and judges herself. */
export function FlipCardExercise({
  view,
  issueKey,
  revealComplete,
  frontAudioAvailable,
  backAudioAvailable,
  tutorOpen,
  tutorDisabled,
  onClose,
  onReveal,
  onGrade,
  onSkip,
  onFrontAudioAvailabilityChange,
  onBackAudioAvailabilityChange,
  onOpenTutor,
  onCloseTutor,
}: {
  view: FlipExerciseView;
  issueKey: string | undefined;
  revealComplete: boolean;
  frontAudioAvailable: boolean;
  backAudioAvailable: boolean;
  tutorOpen: boolean;
  tutorDisabled: boolean;
  onClose: () => void;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
  onSkip: () => void;
  onFrontAudioAvailabilityChange: (available: boolean) => void;
  onBackAudioAvailabilityChange: (available: boolean) => void;
  onOpenTutor: () => void;
  onCloseTutor: () => void;
}) {
  const { t } = useTranslation();
  const reviewSession = useReviewSession();
  const card = view.currentCard;
  const frontRequiredUnavailable =
    !card.front.text && Boolean(card.front.audio) && !frontAudioAvailable;
  const backRequiredUnavailable =
    view.revealed && !card.back.text && Boolean(card.back.audio) && !backAudioAvailable;

  return (
    <ExerciseScreen
      position={view.position}
      total={view.total}
      issueKey={issueKey}
      issueRequestId={view.issueRequestId}
      onClose={onClose}
      dialog={
        tutorOpen && (
          <TutorDialog
            card={card}
            exercise={view.tutorExercise}
            messages={view.tutorConversation}
            updateMessages={reviewSession.updateTutorConversation}
            onClose={onCloseTutor}
          />
        )
      }
    >
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
            onAudioAvailabilityChange={onFrontAudioAvailabilityChange}
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
            onAudioAvailabilityChange={onBackAudioAvailabilityChange}
          />
        </section>
      </div>
      {!view.revealed && (
        <button
          type="button"
          className={styles.revealButton}
          onClick={onReveal}
          disabled={frontRequiredUnavailable}
        >
          {t("review.reveal")}
        </button>
      )}
      {view.revealed && revealComplete && (
        <>
          <TutorButton onClick={onOpenTutor} disabled={tutorDisabled} />
          <fieldset
            className={styles.grades}
            disabled={
              backRequiredUnavailable || view.issue === "clock" || view.issue === "conflict"
            }
          >
            <legend>{t("review.grading")}</legend>
            <button type="button" onClick={() => onGrade("forgot")}>
              {t("review.forgot")}
            </button>
            <button type="button" onClick={() => onGrade("almost")}>
              {t("review.almost")}
            </button>
            <button type="button" onClick={() => onGrade("knew_it")}>
              {t("review.knewIt")}
            </button>
          </fieldset>
        </>
      )}
      {(frontRequiredUnavailable || backRequiredUnavailable) && (
        <AudioUnavailableNotice onSkip={onSkip} />
      )}
    </ExerciseScreen>
  );
}
