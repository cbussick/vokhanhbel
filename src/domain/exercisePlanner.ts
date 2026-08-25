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

export type PlannedExercise = FlipExercise | MultipleChoiceExercise | MatchingExercise;

const optionCount = 4;
const requiredDistractorCount = optionCount - 1;
const matchingGroupSize = 4;

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
 * Plans the fixed Exercise sequence for a Review Session, once, over the due Cards it drew — the
 * only new module the Exercise feature needs. Pure other than the injected random source: same
 * input and random source always produce the same plan.
 *
 * One Exercise per Card, in the order given, except for at most one matching group of four, which
 * a single call plans at most once by construction — that is the whole enforcement of "at most one
 * grouped Exercise per Review Session". `pool` is every Card distractors may be drawn from — wider
 * than `dueCards`, typically every non-deleted Card in the app, since VOK-15 draws from a Card's
 * own Thema and then the rest of its Sammlung rather than only the due queue. A Card whose back has
 * text is offered text options; a Card whose back has only a recording is offered audio options
 * drawn from sibling Cards with recorded backs. A Card with neither, or one that cannot find three
 * distinct sibling backs of its own modality in `pool`, plans as a flip Card instead, and a
 * would-be third consecutive multiple-choice Exercise is demoted to one too.
 *
 * Swipe (VOK-19) is the other grouped Exercise the parent spec alternates matching with; that
 * alternation has no second participant yet. The seam for it is here: once Swipe exists, replace
 * `selectMatchingGroup` below with a chooser that alternates between the two grouped kinds — this
 * function's due Cards and random source are already everything such a chooser would need. Nothing
 * about "last Session's grouped kind" is stored today, deliberately: a session-to-session memory
 * for an alternation with only one member would be speculative state with no way to test it yet.
 */
export function planExercises(
  dueCards: Card[],
  pool: Card[],
  random: RandomSource,
): PlannedExercise[] {
  const matchingGroup = selectMatchingGroup(dueCards);
  const matchingCardIds = new Set(matchingGroup?.map((card) => card.id));
  let matchingPlanned = false;

  const planned = dueCards.flatMap((card): PlannedExercise[] => {
    if (matchingCardIds.has(card.id)) {
      if (matchingPlanned) return [];

      matchingPlanned = true;

      return [toMatchingExercise(matchingGroup!, random)];
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
