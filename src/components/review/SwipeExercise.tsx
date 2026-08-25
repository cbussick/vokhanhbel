import { useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MultipleChoiceOptionView, SwipeExerciseView } from "../../state/ReviewSessionContext";
import { useReviewSession } from "../../state/ReviewSessionContext";
import { CardFace } from "../audio/CardFace";
import { TutorDialog } from "../TutorDialog";
import { ExerciseScreen } from "./ExerciseScreen";
import { OptionOutcome, optionModifierClassName } from "./optionAppearance";
import { TutorButton } from "./TutorButton";
import styles from "./reviewSession.module.css";

/** Whether motion should resolve instantly rather than animate — read fresh each time, since the
 * Learner can change this OS setting without reloading the app. */
function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** How long the fly-off/spring-back CSS transition takes, so the local "still flying" state clears
 * in step with it. Zero under reduced motion, so the outgoing Card is simply gone next paint. */
function swipeFlightDuration(): number {
  return prefersReducedMotion() ? 0 : 260;
}

function pointInRect(x: number, y: number, rect: DOMRect | undefined): boolean {
  return (
    rect !== undefined && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  );
}

/**
 * A deck of three Cards, answered by dragging the top one onto a target or by tapping it. Built on
 * pointer events with geometric hit-testing (`getBoundingClientRect` against the two target
 * buttons' rectangles, checked in `onPointerMove`) rather than mouse-enter detection — the earlier
 * implementation this idea came from detected its drop target that way, so its drag never worked on
 * a phone at all. Tapping a target calls the exact same `commit` path as a completed drag, and
 * needs no pointer handling of its own, which is what makes it the keyboard route for free.
 */
export function SwipeExercise({
  view,
  issueKey,
  tutorOpen,
  tutorDisabled,
  onClose,
  onChoose,
  onContinue,
  onOpenTutor,
  onCloseTutor,
}: {
  view: SwipeExerciseView;
  issueKey: string | undefined;
  tutorOpen: boolean;
  tutorDisabled: boolean;
  onClose: () => void;
  onChoose: (optionCardId: string) => void;
  onContinue: () => void;
  onOpenTutor: () => void;
  onCloseTutor: () => void;
}) {
  const { t } = useTranslation();
  const reviewSession = useReviewSession();
  const [dragCardId, setDragCardId] = useState<string | undefined>(undefined);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragHoverSide, setDragHoverSide] = useState<"left" | "right" | undefined>(undefined);
  const [flying, setFlying] = useState<{ cardId: string; direction: "left" | "right" } | undefined>(
    undefined,
  );
  const leftTargetRef = useRef<HTMLButtonElement>(null);
  const rightTargetRef = useRef<HTMLButtonElement>(null);

  const issueBlocksInput = view.issue === "clock" || view.issue === "conflict";
  const interactive = !view.resolved && !issueBlocksInput;

  const flyOff = (cardId: string, direction: "left" | "right") => {
    setFlying({ cardId, direction });

    const duration = swipeFlightDuration();

    window.setTimeout(
      () => setFlying((current) => (current?.cardId === cardId ? undefined : current)),
      duration,
    );
  };

  const resetDrag = () => {
    setDragCardId(undefined);
    setDragOffset({ x: 0, y: 0 });
    setDragHoverSide(undefined);
  };

  const commit = (optionCardId: string) => {
    onChoose(optionCardId);
    resetDrag();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>, cardId: string) => {
    if (!interactive) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragCardId(cardId);
    setDragStart({ x: event.clientX, y: event.clientY });
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragCardId) return;

    setDragOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });

    const overLeft = pointInRect(
      event.clientX,
      event.clientY,
      leftTargetRef.current?.getBoundingClientRect(),
    );
    const overRight = pointInRect(
      event.clientX,
      event.clientY,
      rightTargetRef.current?.getBoundingClientRect(),
    );

    setDragHoverSide(overLeft ? "left" : overRight ? "right" : undefined);
  };

  const handlePointerUp = () => {
    if (!dragCardId) return;

    const side = dragHoverSide;
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

    // Released nowhere in particular: springs back to centre instead of answering.
    resetDrag();
  };

  // The resolution — correct or wrong — is on screen until this fires, so the fly-off always
  // happens here, toward whichever side the Learner actually chose: the option whose own
  // correctness matches the verdict is the one she picked, since Swipe has only the two.
  const handleContinue = () => {
    if (view.resolved) {
      const chosenIndex = view.options.findIndex((option) => option.correct === view.correct);

      flyOff(view.currentCard.id, chosenIndex === 0 ? "left" : "right");
    }

    onContinue();
  };

  // The current Card plus whatever's genuinely still unresolved behind it, in deck order —
  // everything still worth stacking on screen. Resolved Cards always precede it in `view.cards`,
  // which `toReviewSessionView` and `shrinkSwipeDeck` both keep in lockstep with the deck's order.
  const currentCardIndex = view.cards.findIndex((card) => card.id === view.currentCard.id);
  const upcomingCards = view.cards.slice(currentCardIndex);
  const peekClassNames = [styles.swipeCardPeek1, styles.swipeCardPeek2];

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
            card={view.currentCard}
            exercise={view.tutorExercise}
            messages={view.tutorConversation}
            updateMessages={reviewSession.updateTutorConversation}
            onClose={onCloseTutor}
          />
        )
      }
    >
      <p className={styles.optionsLegend}>{t("review.swipeLegend")}</p>
      <div className={styles.swipeDeck}>
        {flying && (
          <div
            key={`flying-${flying.cardId}`}
            aria-hidden="true"
            className={`${styles.swipeCard} ${styles.swipeCardFlying} ${
              flying.direction === "left" ? styles.swipeCardFlyingLeft : styles.swipeCardFlyingRight
            }`}
          >
            <CardFace
              face={view.cards.find((card) => card.id === flying.cardId)!.front}
              label="front"
            />
          </div>
        )}
        {upcomingCards.slice(0, 3).map((deckCard, index) =>
          index === 0 ? (
            <div
              key={deckCard.id}
              className={`${styles.swipeCard} ${styles.swipeCardCurrent}`}
              style={
                dragCardId === deckCard.id
                  ? {
                      transform: `translate(${dragOffset.x}px, ${dragOffset.y * 0.15}px) rotate(${dragOffset.x / 18}deg)`,
                      transition: "none",
                    }
                  : undefined
              }
              onPointerDown={(event) => handlePointerDown(event, deckCard.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <CardFace face={deckCard.front} label="front" />
            </div>
          ) : (
            <div
              key={deckCard.id}
              aria-hidden="true"
              className={`${styles.swipeCard} ${peekClassNames[index - 1] ?? ""}`}
            >
              <CardFace face={deckCard.front} label="front" />
            </div>
          ),
        )}
      </div>
      <fieldset className={styles.swipeTargets} disabled={view.resolved || issueBlocksInput}>
        <legend className={styles.visuallyHidden}>{t("review.swipeLegend")}</legend>
        {view.options.map((option, index) => {
          const shimOption: MultipleChoiceOptionView = {
            id: option.cardId,
            text: option.text,
            audio: null,
            dead: !option.correct && view.resolved && !view.correct,
            revealedCorrect: view.resolved && option.correct,
          };
          const side = index === 0 ? "left" : "right";

          return (
            <button
              key={option.cardId}
              ref={side === "left" ? leftTargetRef : rightTargetRef}
              type="button"
              className={`${styles.option} ${styles.swipeTarget} ${
                dragHoverSide === side ? styles.swipeTargetHover : ""
              } ${optionModifierClassName(shimOption)}`}
              onClick={() => commit(option.cardId)}
            >
              {option.text}
              <OptionOutcome option={shimOption} />
            </button>
          );
        })}
      </fieldset>
      {view.resolved && (
        <>
          <p className={styles.outcome} role="status">
            {t(view.correct ? "review.answerCorrect" : "review.answerWrong")}
          </p>
          <TutorButton onClick={onOpenTutor} disabled={tutorDisabled} />
          <button type="button" className={styles.revealButton} onClick={handleContinue}>
            {t("review.continue")}
          </button>
        </>
      )}
    </ExerciseScreen>
  );
}
