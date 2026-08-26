import { useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { issueBlocksInput } from "../../state/review/reviewSessionReducer";
import type { SwipeExerciseView } from "../../state/ReviewSessionContext";
import { useReviewSession } from "../../state/ReviewSessionContext";
import { CardFace } from "../audio/CardFace";
import { TutorDialog } from "../TutorDialog";
import { ExerciseScreen } from "./ExerciseScreen";
import { OptionOutcome, optionModifierClassName, type OptionVerdict } from "./optionAppearance";
import { ResolutionFooter } from "./ResolutionFooter";
import styles from "./reviewSession.module.css";

/** Ties the buckets to the one visible copy of the Exercise's instruction. */
const swipeInstructionId = "swipe-instruction";

/** How far along the travel available on one side the Card must be dragged before releasing it
 * counts as choosing that side, and the shortest such distance in pixels — on a narrow screen the
 * proportional distance alone would be small enough to trip on a stray movement. */
const commitTravelRatio = 0.55;
const commitTravelMinimum = 32;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The drag distance that arms a side, never more than the travel that side actually has. */
function commitThreshold(travel: number): number {
  return Math.min(Math.max(travel * commitTravelRatio, commitTravelMinimum), travel);
}

/**
 * One Card thrown into one of two buckets, by dragging it far enough toward one or by tapping it.
 * Built on pointer events rather than mouse-enter detection — the earlier implementation this idea
 * came from detected its drop target that way, so its drag never worked on a phone at all. Which
 * side a drag chooses is decided by distance travelled, not by where the pointer ends up: see
 * `commitThreshold`. Tapping a bucket calls the exact same `commit` path as a completed drag, and
 * needs no pointer handling of its own, which is what makes it the keyboard route for free.
 */
export function SwipeExercise({
  view,
  issueKey,
  tutorOpen,
  tutorDisabled,
  onClose,
  onChoose,
  onAdvance,
  onOpenTutor,
  onCloseTutor,
}: {
  view: SwipeExerciseView;
  issueKey: string | undefined;
  tutorOpen: boolean;
  tutorDisabled: boolean;
  onClose: () => void;
  onChoose: (optionCardId: string) => void;
  onAdvance: () => void;
  onOpenTutor: () => void;
  onCloseTutor: () => void;
}) {
  const { t } = useTranslation();
  const reviewSession = useReviewSession();
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  // The side the Card has been dragged far enough to choose — released now, it lands there.
  const [armedSide, setArmedSide] = useState<"left" | "right" | undefined>(undefined);
  const arenaRef = useRef<HTMLFieldSetElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const inputBlocked = issueBlocksInput(view.issue);
  const interactive = !view.resolved && !inputBlocked;

  const resetDrag = () => {
    setDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setArmedSide(undefined);
  };

  const commit = (optionCardId: string) => {
    onChoose(optionCardId);
    resetDrag();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;

    const requested = { x: event.clientX - dragStart.x, y: (event.clientY - dragStart.y) * 0.15 };
    const arena = arenaRef.current?.getBoundingClientRect();
    const card = cardRef.current?.getBoundingClientRect();

    if (!arena || !card) return;

    // `card` is measured mid-drag, so the offset already applied to it comes back off to recover the
    // resting rect the new offset is measured against.
    const travelLeft = card.left - dragOffset.x - arena.left;
    const travelRight = arena.right - (card.right - dragOffset.x);
    // The Card stays inside the arena: dragged past an edge it stops there rather than sliding out
    // across the rest of the screen.
    const bounded = {
      x: clamp(requested.x, -travelLeft, travelRight),
      y: clamp(
        requested.y,
        arena.top - (card.top - dragOffset.y),
        arena.bottom - (card.bottom - dragOffset.y),
      ),
    };

    setDragOffset(bounded);
    // Distance decides, not what the pointer happens to be over. A thumb dragging a Card on a phone
    // is nowhere near the bucket it is aiming at, and the Card itself is bound inside the arena, so
    // asking the pointer to reach the target made the gesture far harder than it looks.
    setArmedSide(
      bounded.x <= -commitThreshold(travelLeft)
        ? "left"
        : bounded.x >= commitThreshold(travelRight)
          ? "right"
          : undefined,
    );
  };

  const handlePointerUp = () => {
    if (!dragging) return;

    const side = armedSide;
    const optionCardId =
      side === "left"
        ? view.options[0]?.cardId
        : side === "right"
          ? view.options[1]?.cardId
          : undefined;

    if (side && optionCardId) {
      commit(optionCardId);

      return;
    }

    // Released short of either threshold: springs back to centre instead of answering.
    resetDrag();
  };

  const renderBucket = (index: number, side: "left" | "right") => {
    const option = view.options[index];

    if (!option) return null;

    const verdict: OptionVerdict = {
      dead: !option.correct && view.resolved && !view.correct,
      revealedCorrect: view.resolved && option.correct,
    };

    return (
      <button
        type="button"
        className={`${styles.swipeBucket} ${armedSide === side ? styles.swipeBucketArmed : ""} ${optionModifierClassName(verdict)}`}
        onClick={() => commit(option.cardId)}
      >
        {option.text}
        <OptionOutcome verdict={verdict} />
      </button>
    );
  };

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
          verdict={t(view.correct ? "review.answerCorrect" : "review.answerWrong")}
          onAdvance={onAdvance}
          tutor={{ onOpen: onOpenTutor, disabled: tutorDisabled }}
        />
      }
      dialog={
        tutorOpen &&
        view.resolved && (
          <TutorDialog
            card={view.currentCard}
            exercise={view.tutorExercise}
            messages={view.tutorConversation}
            updateMessages={reviewSession.updateTutorConversation}
            onClose={onCloseTutor}
          />
        )
      }
    >
      <p id={swipeInstructionId} className={styles.exerciseInstruction}>
        {t("review.swipeLegend")}
      </p>
      <fieldset
        ref={arenaRef}
        className={styles.swipeArena}
        aria-labelledby={swipeInstructionId}
        disabled={view.resolved || inputBlocked}
      >
        {renderBucket(0, "left")}
        <div className={styles.swipeDeck}>
          <div
            ref={cardRef}
            className={`${styles.swipeCard} ${interactive ? styles.swipeCardDraggable : ""}`}
            style={
              dragging
                ? {
                    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x / 18}deg)`,
                    transition: "none",
                  }
                : undefined
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <CardFace face={view.currentCard.front} label="front" />
          </div>
        </div>
        {renderBucket(1, "right")}
      </fieldset>
    </ExerciseScreen>
  );
}
