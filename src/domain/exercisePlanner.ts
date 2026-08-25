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
 * Splits `pool` into the two tiers distractors are drawn from, in priority order: the Cards sharing
 * a Thema with `card`, then the rest of its Sammlung. Never crosses into another Sammlung. A Card in
 * several Themen draws candidates from all of them, since membership is checked with `some`.
 *
 * Only text-back Cards are eligible: this wave matches modality by construction (a text back is
 * offered text options only) because audio options don't exist yet — see VOK-17.
 */
function distractorTiers(card: Card, pool: Card[]) {
  const eligible = pool.filter(
    (candidate) =>
      candidate.id !== card.id &&
      candidate.deletedAt === null &&
      candidate.collectionId === card.collectionId &&
      candidate.back.text,
  );
  const sharesThema = (candidate: Card) =>
    candidate.topicIds.some((topicId) => card.topicIds.includes(topicId));
  const thema = card.topicIds.length > 0 ? eligible.filter(sharesThema) : [];
  const inThema = new Set(thema.map((candidate) => candidate.id));
  const sammlung = eligible.filter((candidate) => !inThema.has(candidate.id));

  return { thema, sammlung };
}

/**
 * Distractors for `card`: up to three Cards from `pool`, Thema first and then the rest of the
 * Sammlung, whose back text differs — after Card-list normalization — from the correct back and
 * from every distractor already chosen. Two Cards may legitimately share a back, so this is
 * checked rather than assumed.
 *
 * The matching helper (VOK-18) is the next thing likely to touch this function.
 */
function findDistractors(card: Card, pool: Card[], random: RandomSource): Card[] {
  const correctBack = normalizeCardText(card.back.text ?? "");
  const seenBacks = new Set([correctBack]);
  const { thema, sammlung } = distractorTiers(card, pool);
  // Each tier is shuffled on its own, so a candidate from the Sammlung can never be drawn ahead of
  // one from the Thema — only within-tier order is random.
  const candidates = [...shuffle(thema, random), ...shuffle(sammlung, random)];
  const distractors: Card[] = [];

  for (const candidate of candidates) {
    if (distractors.length === requiredDistractorCount) break;

    const back = normalizeCardText(candidate.back.text ?? "");

    if (seenBacks.has(back)) continue;

    seenBacks.add(back);
    distractors.push(candidate);
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
 * Demotes a multiple-choice Exercise to a flip Card wherever placing it would make three of the
 * same kind run consecutively. Flip is the universal fallback, so demoting into it is always safe;
 * there is nothing lower to demote a run of flip Cards to, and this must never invent an Exercise a
 * Card wasn't eligible for. Where every Card is flip-only (a tiny Sammlung), a run of flip Cards
 * stands — completing the Session correctly wins over variety.
 */
function limitRepeatedKind(exercises: PlannedExercise[]): PlannedExercise[] {
  const limited: PlannedExercise[] = [];

  for (const exercise of exercises) {
    const wouldRunThree =
      limited.length >= 2 &&
      limited[limited.length - 1]!.kind === exercise.kind &&
      limited[limited.length - 2]!.kind === exercise.kind;

    limited.push(
      wouldRunThree && exercise.kind === "multipleChoice"
        ? toFlipExercise(exercise.cards[0]!)
        : exercise,
    );
  }

  return limited;
}

/**
 * Plans the fixed Exercise sequence for a Review Session, once, over the due Cards it drew — the
 * only new module the Exercise feature needs. Pure other than the injected random source: same
 * input and random source always produce the same plan.
 *
 * One Exercise per Card, in the order given. `pool` is every Card distractors may be drawn from —
 * wider than `dueCards`, typically every non-deleted Card in the app, since VOK-15 draws from a
 * Card's own Thema and then the rest of its Sammlung rather than only the due queue. A Card whose
 * back has no text, or that cannot find three distinct sibling backs in `pool`, plans as a flip
 * Card instead, and a would-be third consecutive multiple-choice Exercise is demoted to one too.
 */
export function planExercises(
  dueCards: Card[],
  pool: Card[],
  random: RandomSource,
): PlannedExercise[] {
  const planned = dueCards.map((card) => {
    if (!card.back.text) return toFlipExercise(card);

    const distractors = findDistractors(card, pool, random);

    if (distractors.length < requiredDistractorCount) return toFlipExercise(card);

    return toMultipleChoiceExercise(card, distractors, random);
  });

  return limitRepeatedKind(planned);
}
