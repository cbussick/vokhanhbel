import { useTranslation } from "react-i18next";
import type { Card } from "../../contracts/card";
import type { MatchingEntryView, MatchingExerciseView } from "../../state/ReviewSessionContext";
import { useReviewSession } from "../../state/ReviewSessionContext";
import { TutorDialog } from "../TutorDialog";
import { ExerciseScreen } from "./ExerciseScreen";
import styles from "./reviewSession.module.css";

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
 * Four Cards in two shuffled columns. A pair resolves the moment a front and a back are tapped —
 * see `ReviewSessionContext.attemptMatchingPair` — so unlike multiple choice there is no
 * per-Exercise "resolved" state to wait for until every pair on the board has graded.
 */
export function MatchingExercise({
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
    <ExerciseScreen
      position={view.position}
      total={view.total}
      issueKey={issueKey}
      issueRequestId={view.issueRequestId}
      onClose={onClose}
      dialog={
        tutorOpen &&
        tutorCard &&
        view.resolved && (
          <TutorDialog
            card={tutorCard}
            exercise={view.tutorExercise}
            messages={view.tutorConversation}
            updateMessages={reviewSession.updateTutorConversation}
            onClose={onCloseTutor}
          />
        )
      }
    >
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
    </ExerciseScreen>
  );
}
