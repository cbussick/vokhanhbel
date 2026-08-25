import { useTranslation } from "react-i18next";
import type { MultipleChoiceExerciseView } from "../../state/ReviewSessionContext";
import { useReviewSession } from "../../state/ReviewSessionContext";
import { CardFace } from "../audio/CardFace";
import { TutorDialog } from "../TutorDialog";
import { AudioUnavailableNotice } from "./AudioUnavailableNotice";
import { ExerciseScreen } from "./ExerciseScreen";
import { MultipleChoiceOptions } from "./MultipleChoiceOptions";
import { TutorButton } from "./TutorButton";
import styles from "./reviewSession.module.css";

/**
 * The Card's front with four options beneath it — the correct back and three distractors, text or
 * audio but never both. Resolution is a state, not an animation: nothing advances until "Weiter".
 */
export function MultipleChoiceExercise({
  view,
  issueKey,
  frontAudioAvailable,
  unavailableOptionIds,
  tutorOpen,
  tutorDisabled,
  onClose,
  onAdvance,
  onSkip,
  onFrontAudioAvailabilityChange,
  onOptionAvailabilityChange,
  onOpenTutor,
  onCloseTutor,
}: {
  view: MultipleChoiceExerciseView;
  issueKey: string | undefined;
  frontAudioAvailable: boolean;
  unavailableOptionIds: ReadonlySet<string>;
  tutorOpen: boolean;
  tutorDisabled: boolean;
  onClose: () => void;
  onAdvance: () => void;
  onSkip: () => void;
  onFrontAudioAvailabilityChange: (available: boolean) => void;
  onOptionAvailabilityChange: (optionId: string, available: boolean) => void;
  onOpenTutor: () => void;
  onCloseTutor: () => void;
}) {
  const { t } = useTranslation();
  const reviewSession = useReviewSession();
  const card = view.currentCard;
  const frontRequiredUnavailable =
    !card.front.text && Boolean(card.front.audio) && !frontAudioAvailable;
  // While any audio option has failed to load, guessing between the ones the Learner can still hear
  // would record a Grade she never gave — so grading stays blocked until every option recovers.
  const optionsAudioUnavailable = !view.resolved && unavailableOptionIds.size > 0;

  return (
    <ExerciseScreen
      position={view.position}
      total={view.total}
      issueKey={issueKey}
      issueRequestId={view.issueRequestId}
      onClose={onClose}
      dialog={
        tutorOpen &&
        view.resolved && (
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
      <div className={styles.promptFace}>
        <CardFace
          face={card.front}
          label="front"
          onAudioAvailabilityChange={onFrontAudioAvailabilityChange}
        />
      </div>
      <MultipleChoiceOptions
        options={view.options}
        resolved={view.resolved}
        disabled={frontRequiredUnavailable || view.issue === "clock" || view.issue === "conflict"}
        audioUnavailable={optionsAudioUnavailable}
        onOptionAvailabilityChange={onOptionAvailabilityChange}
        onChoose={reviewSession.chooseOption}
      />
      {view.resolved && (
        <>
          <p className={styles.outcome} role="status">
            {t(view.correct ? "review.answerCorrect" : "review.answerWrong")}
          </p>
          <TutorButton onClick={onOpenTutor} disabled={tutorDisabled} />
          <button type="button" className={styles.revealButton} onClick={onAdvance}>
            {t("review.continue")}
          </button>
        </>
      )}
      {(frontRequiredUnavailable || optionsAudioUnavailable) && (
        <AudioUnavailableNotice onSkip={onSkip} />
      )}
    </ExerciseScreen>
  );
}
