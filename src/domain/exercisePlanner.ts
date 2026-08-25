import type { Card } from "../contracts/card.js";
import { normalizeCardText } from "./cardText.js";

/** Returns a float in [0, 1), like `Math.random`. Injected so a plan is assertable in a test. */
export type RandomSource = () => number;

export interface MultipleChoiceOption {
  /** The id of the Card whose back supplied this option's text. */
  cardId: string;
  text: string;
  correct: boolean;
}

export interface FlipExercise {
  kind: "flip";
  id: string;
  /** The Cards this Exercise grades. Always one here; a grouped Exercise (VOK-18/VOK-19) has more. */
  cards: Card[];
}

export interface MultipleChoiceExercise {
  kind: "multipleChoice";
  id: string;
  cards: Card[];
  /** Four options in presentation order, already shuffled. Exactly one has `correct: true`. */
  options: MultipleChoiceOption[];
}

export type PlannedExercise = FlipExercise | MultipleChoiceExercise;

const optionCount = 4;
const requiredDistractorCount = optionCount - 1;

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));

    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled;
}

/**
 * Distractors for `card`: any other Card in `pool` in the same Collection whose back text differs,
 * after Card-list normalization, from the correct back and from every distractor already chosen.
 *
 * Deliberately crude — this is every rule VOK-14 needs. Thema-first sourcing, modality matching and
 * the no-three-in-a-row rule belong in this function when VOK-15 refines it; the call site and the
 * Exercise shape are not expected to change.
 */
function findDistractors(card: Card, pool: Card[], random: RandomSource): Card[] {
  const correctBack = normalizeCardText(card.back.text ?? "");
  const seenBacks = new Set([correctBack]);
  const siblings = pool.filter(
    (candidate) =>
      candidate.id !== card.id &&
      candidate.collectionId === card.collectionId &&
      candidate.back.text,
  );
  const distractors: Card[] = [];

  for (const candidate of shuffle(siblings, random)) {
    const back = normalizeCardText(candidate.back.text ?? "");

    if (seenBacks.has(back)) continue;

    seenBacks.add(back);
    distractors.push(candidate);

    if (distractors.length === requiredDistractorCount) break;
  }

  return distractors;
}

function toFlipExercise(card: Card): FlipExercise {
  return { kind: "flip", id: card.id, cards: [card] };
}

function toMultipleChoiceExercise(
  card: Card,
  distractors: Card[],
  random: RandomSource,
): MultipleChoiceExercise {
  // SAFETY: card.back.text and each distractor's back.text were checked non-null by the caller
  // (findDistractors filters candidates without back text, and the card itself is checked in
  // planExercises before this is called).
  const correctOption: MultipleChoiceOption = {
    cardId: card.id,
    text: card.back.text!,
    correct: true,
  };
  const distractorOptions: MultipleChoiceOption[] = distractors.map((distractor) => ({
    cardId: distractor.id,
    text: distractor.back.text!,
    correct: false,
  }));

  return {
    kind: "multipleChoice",
    id: card.id,
    cards: [card],
    options: shuffle([correctOption, ...distractorOptions], random),
  };
}

/**
 * Plans the fixed Exercise sequence for a Review Session, once, over the due Cards it drew — the
 * only new module the Exercise feature needs. Pure other than the injected random source: same
 * input and random source always produce the same plan.
 *
 * One Exercise per Card, in the order given. A Card whose back has no text, or that cannot find
 * three distinct sibling backs among these same due Cards, plans as a flip Card instead.
 */
export function planExercises(dueCards: Card[], random: RandomSource): PlannedExercise[] {
  return dueCards.map((card) => {
    if (!card.back.text) return toFlipExercise(card);

    const distractors = findDistractors(card, dueCards, random);

    if (distractors.length < requiredDistractorCount) return toFlipExercise(card);

    return toMultipleChoiceExercise(card, distractors, random);
  });
}
