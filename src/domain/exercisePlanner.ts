import type { AudioMetadata, Card } from "../contracts/card.js";
import { normalizeCardText } from "./cardText.js";

/** Returns a float in [0, 1), like `Math.random`. Injected so a plan is assertable in a test. */
export type RandomSource = () => number;

export interface MultipleChoiceOption {
  /** The id of the Card whose back supplied this option. */
  cardId: string;
  correct: boolean;
  /**
   * Exactly one of `text`/`audio` is set, and every option in one Exercise shares the same one —
   * modality never mixes within an Exercise, matching the correct answer's back.
   */
  text: string | null;
  audio: AudioMetadata | null;
}

/** The kind of back an Exercise's options are drawn from. Never mixed within one Exercise. */
type Modality = "text" | "audio";

export interface FlipExercise {
  kind: "flip";
  id: string;
  /** The Cards this Exercise grades. Always one here; a grouped Exercise (matching, Swipe) has more. */
  cards: Card[];
}

export interface MultipleChoiceExercise {
  kind: "multipleChoice";
  id: string;
  cards: Card[];
  /** Four options in presentation order, already shuffled. Exactly one has `correct: true`. */
  options: MultipleChoiceOption[];
}

export interface MatchingExercise {
  kind: "matching";
  id: string;
  /** The Cards being matched. Four when freshly planned; a reducer-level rejection (VOK-18) may
   * shrink this below four as the board loses a pair, down to the two-pair minimum. */
  cards: Card[];
  /** Card ids in the shuffled order their fronts are shown, left column. */
  frontOrder: string[];
  /** Card ids in the shuffled order their backs are shown, right column — shuffled independently
   * of `frontOrder`, so a front and its back never land on the same row. */
  backOrder: string[];
}

export interface SwipeOption {
  /** The id of the Card whose back supplied this option — the swiped Card itself when `correct`,
   * its one distractor otherwise. */
  cardId: string;
  correct: boolean;
  text: string;
}

export interface SwipeCard {
  /** The Card this position in the deck grades. */
  cardId: string;
  /** The two text options shown left and right, already shuffled — exactly one has `correct: true`. */
  options: SwipeOption[];
}

/** The Cards and per-Card options a Swipe deck presents, before being wrapped as an Exercise —
 * `selectSwipeDeck`'s result and `toSwipeExercise`'s input. */
interface SwipeDeckSelection {
  cards: Card[];
  deck: SwipeCard[];
}

export interface SwipeExercise {
  kind: "swipe";
  id: string;
  /** The deck's three Cards, in stacked presentation order — index 0 is on top, shown first. */
  cards: Card[];
  /** One entry per Card in `cards`, same order. */
  deck: SwipeCard[];
}

export type PlannedExercise =
  | FlipExercise
  | MultipleChoiceExercise
  | MatchingExercise
  | SwipeExercise;

/** The one grouped Exercise a Session may plan — at most one per Session, alternating type between
 * Sessions. See `planExercises`'s `previousGroupedKind` parameter for how the alternation works. */
export type GroupedExerciseKind = "matching" | "swipe";

const optionCount = 4;
const requiredDistractorCount = optionCount - 1;
const matchingGroupSize = 4;
const swipeDeckSize = 3;

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));

    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled;
}

/** The card face has a back in the given modality: non-empty text, or a recording. */
function hasBack(card: Card, modality: Modality): boolean {
  return modality === "text" ? Boolean(card.back.text) : Boolean(card.back.audio);
}

/**
 * A back's identity for de-duplication: normalized text for a text back, the recording's id for
 * an audio one. Two Cards may legitimately share either.
 */
function backIdentity(card: Card, modality: Modality): string {
  return modality === "text" ? normalizeCardText(card.back.text ?? "") : card.back.audio!.id;
}

/**
 * Splits `pool` into the two tiers distractors are drawn from, in priority order: the Cards sharing
 * a Thema with `card`, then the rest of its Sammlung. Never crosses into another Sammlung. A Card in
 * several Themen draws candidates from all of them, since membership is checked with `some`.
 *
 * Only Cards whose back matches `modality` are eligible — a text back draws text-back siblings, an
 * audio back draws audio-back siblings — so text and audio options never appear in the same
 * Exercise.
 */
function distractorTiers(card: Card, pool: Card[], modality: Modality) {
  const eligible = pool.filter(
    (candidate) =>
      candidate.id !== card.id &&
      candidate.deletedAt === null &&
      candidate.collectionId === card.collectionId &&
      hasBack(candidate, modality),
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
 * Sammlung, whose back — after Card-list normalization for text, or by recording id for audio —
 * differs from the correct back and from every distractor already chosen. Two Cards may
 * legitimately share a back, so this is checked rather than assumed.
 */
function findDistractors(
  card: Card,
  pool: Card[],
  random: RandomSource,
  modality: Modality,
): Card[] {
  const seenBacks = new Set([backIdentity(card, modality)]);
  const { thema, sammlung } = distractorTiers(card, pool, modality);
  // Each tier is shuffled on its own, so a candidate from the Sammlung can never be drawn ahead of
  // one from the Thema — only within-tier order is random.
  const candidates = [...shuffle(thema, random), ...shuffle(sammlung, random)];
  const distractors: Card[] = [];

  for (const candidate of candidates) {
    if (distractors.length === requiredDistractorCount) break;

    const back = backIdentity(candidate, modality);

    if (seenBacks.has(back)) continue;

    seenBacks.add(back);
    distractors.push(candidate);
  }

  return distractors;
}

function toFlipExercise(card: Card): FlipExercise {
  return { kind: "flip", id: card.id, cards: [card] };
}

function toOption(card: Card, correct: boolean, modality: Modality): MultipleChoiceOption {
  // SAFETY: `hasBack` was checked non-null by the caller for both the correct Card (in
  // planExercises) and every distractor (in distractorTiers) before this is called.
  return {
    cardId: card.id,
    correct,
    text: modality === "text" ? card.back.text! : null,
    audio: modality === "audio" ? card.back.audio! : null,
  };
}

/**
 * The four due Cards a matching Exercise pairs, or undefined when fewer than four fit. Matching
 * needs text on both faces (no audio option exists for it), never crosses into another Sammlung —
 * the same rule VOK-15's distractors follow, for the same reason: pairing words from unrelated
 * Sammlungen isn't a plausible match — and no two entries within a column sharing normalized text,
 * since a duplicate would make that column ambiguous to match. Scans `dueCards` in order and keeps
 * the first four that fit, skipping a Card that would collide with one already chosen rather than
 * disqualifying the whole group — one repeated back doesn't cost matching to the rest of the due
 * queue.
 */
function selectMatchingGroup(dueCards: Card[]): Card[] | undefined {
  const chosen: Card[] = [];
  const seenFronts = new Set<string>();
  const seenBacks = new Set<string>();

  for (const card of dueCards) {
    if (!card.front.text || !card.back.text) continue;
    if (chosen.length > 0 && card.collectionId !== chosen[0]!.collectionId) continue;

    const front = normalizeCardText(card.front.text);
    const back = normalizeCardText(card.back.text);

    if (seenFronts.has(front) || seenBacks.has(back)) continue;

    chosen.push(card);
    seenFronts.add(front);
    seenBacks.add(back);

    if (chosen.length === matchingGroupSize) return chosen;
  }

  return undefined;
}

/**
 * The three due Cards a Swipe deck presents, or undefined when fewer than three fit. Eligibility is
 * narrower than multiple choice's: Swipe needs only one distractor for the correct back's Card, so
 * it reaches Cards multiple choice cannot — but a Card that finds three distinct sibling backs is
 * left for multiple choice, which makes fuller use of them; Swipe only ever claims a Card whose
 * distractor count falls short of that. Both targets are text, so eligibility is fixed to the "text"
 * modality regardless of any other Card's Exercise — a Card whose back is a recording can never be a
 * Swipe target or a Swipe distractor. Scans `dueCards` in order, like `selectMatchingGroup`, and
 * keeps the first three Cards that qualify.
 */
function selectSwipeDeck(
  dueCards: Card[],
  pool: Card[],
  random: RandomSource,
): SwipeDeckSelection | undefined {
  const cards: Card[] = [];
  const deck: SwipeCard[] = [];

  for (const card of dueCards) {
    if (!hasBack(card, "text")) continue;

    const distractors = findDistractors(card, pool, random, "text");

    if (distractors.length === 0 || distractors.length >= requiredDistractorCount) continue;

    const distractor = distractors[0]!;
    const correctOption: SwipeOption = { cardId: card.id, correct: true, text: card.back.text! };
    const distractorOption: SwipeOption = {
      cardId: distractor.id,
      correct: false,
      text: distractor.back.text!,
    };

    cards.push(card);
    deck.push({ cardId: card.id, options: shuffle([correctOption, distractorOption], random) });

    if (cards.length === swipeDeckSize) return { cards, deck };
  }

  return undefined;
}

function toSwipeExercise(swipeDeck: SwipeDeckSelection): SwipeExercise {
  return {
    kind: "swipe",
    // Composite rather than a single Card id, like matching's — this Exercise has no one subject
    // Card either.
    id: swipeDeck.cards.map((card) => card.id).join(":"),
    cards: swipeDeck.cards,
    deck: swipeDeck.deck,
  };
}

function toMatchingExercise(cards: Card[], random: RandomSource): MatchingExercise {
  const cardIds = cards.map((card) => card.id);

  return {
    kind: "matching",
    // Composite rather than a single Card id, since this Exercise has no one subject Card.
    id: cardIds.join(":"),
    cards,
    frontOrder: shuffle(cardIds, random),
    backOrder: shuffle(cardIds, random),
  };
}

function toMultipleChoiceExercise(
  card: Card,
  distractors: Card[],
  random: RandomSource,
  modality: Modality,
): MultipleChoiceExercise {
  const correctOption = toOption(card, true, modality);
  const distractorOptions = distractors.map((distractor) => toOption(distractor, false, modality));

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
 * The order to try the two grouped-Exercise kinds in — opposite of last Session's, which is the
 * whole enforcement of "alternating between Sessions" (planning stops at the first one that finds
 * enough Cards, so only the leading kind is ever actually tried when it succeeds). `undefined` (no
 * Session on record yet — see `browserState.ts`) keeps the matching-first order this planner always
 * used before Swipe existed.
 */
function groupedExerciseOrder(
  previousGroupedKind: GroupedExerciseKind | undefined,
): GroupedExerciseKind[] {
  return previousGroupedKind === "matching" ? ["swipe", "matching"] : ["matching", "swipe"];
}

/**
 * Plans the fixed Exercise sequence for a Review Session, once, over the due Cards it drew — the
 * only new module the Exercise feature needs. Pure other than the injected random source and
 * `previousGroupedKind`: same inputs always produce the same plan.
 *
 * One Exercise per Card, in the order given, except for at most one grouped Exercise — a matching
 * group of four or a Swipe deck of three — which a single call plans at most once by construction:
 * that is the whole enforcement of "at most one grouped Exercise per Review Session". Which kind is
 * tried first is `previousGroupedKind`'s alternation (see `groupedExerciseOrder`); the call site owns
 * remembering and persisting that value across Sessions, since this function stays pure and reaches
 * for no storage of its own.
 *
 * `pool` is every Card distractors may be drawn from — wider than `dueCards`, typically every
 * non-deleted Card in the app, since VOK-15 draws from a Card's own Thema and then the rest of its
 * Sammlung rather than only the due queue. A Card whose back has text is offered text options; a
 * Card whose back has only a recording is offered audio options drawn from sibling Cards with
 * recorded backs. A Card with neither, or one that cannot find three distinct sibling backs of its
 * own modality in `pool`, plans as a flip Card instead — unless it and two other due Cards can each
 * supply at least one sibling back, in which case those three plan as a Swipe deck instead of falling
 * all the way to flip (see `selectSwipeDeck`). A would-be third consecutive multiple-choice Exercise
 * is demoted to a flip Card too.
 */
export function planExercises(
  dueCards: Card[],
  pool: Card[],
  random: RandomSource,
  previousGroupedKind?: GroupedExerciseKind,
): PlannedExercise[] {
  let matchingGroup: Card[] | undefined;
  let swipeDeck: SwipeDeckSelection | undefined;

  for (const kind of groupedExerciseOrder(previousGroupedKind)) {
    if (kind === "matching") {
      matchingGroup = selectMatchingGroup(dueCards);
      if (matchingGroup) break;
    } else {
      swipeDeck = selectSwipeDeck(dueCards, pool, random);
      if (swipeDeck) break;
    }
  }

  const matchingCardIds = new Set(matchingGroup?.map((card) => card.id));
  const swipeCardIds = new Set(swipeDeck?.cards.map((card) => card.id));
  let matchingPlanned = false;
  let swipePlanned = false;

  const planned = dueCards.flatMap((card): PlannedExercise[] => {
    if (matchingCardIds.has(card.id)) {
      if (matchingPlanned) return [];

      matchingPlanned = true;

      return [toMatchingExercise(matchingGroup!, random)];
    }

    if (swipeCardIds.has(card.id)) {
      if (swipePlanned) return [];

      swipePlanned = true;

      return [toSwipeExercise(swipeDeck!)];
    }

    const modality: Modality | undefined = card.back.text
      ? "text"
      : card.back.audio
        ? "audio"
        : undefined;

    if (!modality) return [toFlipExercise(card)];

    const distractors = findDistractors(card, pool, random, modality);

    if (distractors.length < requiredDistractorCount) return [toFlipExercise(card)];

    return [toMultipleChoiceExercise(card, distractors, random, modality)];
  });

  return limitRepeatedKind(planned);
}
