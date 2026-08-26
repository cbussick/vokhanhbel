import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Card } from "../../contracts/card";
import { issueBlocksInput } from "../../state/review/reviewSessionReducer";
import type { MatchingEntryView, MatchingExerciseView } from "../../state/ReviewSessionContext";
import { useReviewSession } from "../../state/ReviewSessionContext";
import { TutorDialog } from "../TutorDialog";
import { ExerciseScreen } from "./ExerciseScreen";
import { ResolutionFooter } from "./ResolutionFooter";
import styles from "./reviewSession.module.css";

type MatchingSide = "front" | "back";

interface MatchingSelection {
  cardId: string;
  side: MatchingSide;
}

/** The two entries of a rejected attempt. Identified per column rather than by Card id alone: every
 * Card has an entry in both columns, so a bare id would light up its partner entry as well. */
interface MatchingMismatch {
  frontCardId: string;
  backCardId: string;
}

function MatchingEntryButton({
  entry,
  selected,
  mismatched,
  disabled,
  onClick,
}: {
  entry: MatchingEntryView;
  selected: boolean;
  mismatched: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const modifier = entry.matched
    ? styles.matchingEntryMatched
    : mismatched
      ? styles.matchingEntryMismatched
      : selected
        ? styles.matchingEntrySelected
        : "";

  return (
    <button
      type="button"
      className={`${styles.matchingEntry} ${modifier}`}
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
 *
 * Either column may start a pair: the first tap selects, and a tap in the opposite column completes
 * the attempt. Selection and the wrong-pair feedback live here rather than in the route because
 * neither outlives the board — at most one matching Exercise is planned per Review Session, so this
 * component unmounts between boards and the state resets with it.
 */
export function MatchingExercise({
  view,
  issueKey,
  online,
  tutorOpen,
  tutorCard,
  onClose,
  onAdvance,
  onOpenTutor,
  onCloseTutor,
}: {
  view: MatchingExerciseView;
  issueKey: string | undefined;
  online: boolean;
  tutorOpen: boolean;
  tutorCard: Card | undefined;
  onClose: () => void;
  onAdvance: () => void;
  onOpenTutor: (cardId: string) => void;
  onCloseTutor: () => void;
}) {
  const { t } = useTranslation();
  const reviewSession = useReviewSession();
  const [selection, setSelection] = useState<MatchingSelection | undefined>(undefined);
  // The last wrong attempt, flashed red until the next tap. Held until then rather than cleared on
  // a timer, so the reason a pair was rejected stays readable at the Learner's own pace.
  const [mismatch, setMismatch] = useState<MatchingMismatch | undefined>(undefined);
  const inputBlocked = issueBlocksInput(view.issue);
  const isSelected = (cardId: string, side: MatchingSide) =>
    selection?.cardId === cardId && selection.side === side;
  const isMismatched = (cardId: string, side: MatchingSide) =>
    cardId === (side === "front" ? mismatch?.frontCardId : mismatch?.backCardId);

  const tap = (entry: MatchingEntryView, side: MatchingSide) => {
    // A matched entry only responds once the whole board has resolved, and then it opens Tutopher
    // instead of attempting another pair — the Learner has nothing left to match it against.
    if (entry.matched) {
      if (view.resolved && online) onOpenTutor(entry.cardId);

      return;
    }

    if (inputBlocked) return;

    setMismatch(undefined);

    if (!selection || selection.side === side) {
      // Tapping the current selection again clears it; any other tap in the same column moves it.
      setSelection(isSelected(entry.cardId, side) ? undefined : { cardId: entry.cardId, side });

      return;
    }

    const frontCardId = side === "front" ? entry.cardId : selection.cardId;
    const backCardId = side === "front" ? selection.cardId : entry.cardId;

    reviewSession.attemptMatchingPair(frontCardId, backCardId);
    setSelection(undefined);
    if (frontCardId !== backCardId) setMismatch({ frontCardId, backCardId });
  };

  const renderColumn = (entries: MatchingEntryView[], side: MatchingSide, legend: string) => (
    <fieldset className={styles.matchingColumn} disabled={inputBlocked}>
      <legend>{legend}</legend>
      {entries.map((entry) => (
        <MatchingEntryButton
          key={entry.cardId}
          entry={entry}
          selected={isSelected(entry.cardId, side)}
          mismatched={isMismatched(entry.cardId, side)}
          disabled={entry.matched && (!view.resolved || !online)}
          onClick={() => tap(entry, side)}
        />
      ))}
    </fieldset>
  );

  return (
    <ExerciseScreen
      position={view.position}
      total={view.total}
      issueKey={issueKey}
      issueRequestId={view.issueRequestId}
      onClose={onClose}
      footer={
        <ResolutionFooter
          resolved={view.resolved}
          verdict={t("review.matchingResolved")}
          onAdvance={onAdvance}
        />
      }
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
      <p className={styles.exerciseInstruction}>{t("review.matchingLegend")}</p>
      <div className={styles.matchingBoard}>
        {renderColumn(view.front, "front", t("review.matchingFrontColumn"))}
        {renderColumn(view.back, "back", t("review.matchingBackColumn"))}
      </div>
      {/* Always mounted, so the live region is in place before it has anything to announce and the
          board never shifts under the Learner when a wrong pair appears. */}
      <p className={styles.matchingMismatch} role="status" aria-atomic="true">
        {mismatch && t("review.matchingMismatch")}
      </p>
    </ExerciseScreen>
  );
}
