import { getIntervalDays } from "./review.js";
import { shiftCalendarDay, toBerlinDay } from "./time.js";

export interface StreakCard {
  id: string;
  createdAt: Date;
  deletedAt: Date | null;
}

/**
 * The Review facts the Streak needs. Deliberately excludes `recordedAt`: the Streak credits the
 * day the Learner answered, so the shape that reaches this derivation has no server timestamp to
 * fall back to by mistake.
 */
export interface StreakReview {
  cardId: string;
  reviewedAt: Date;
  boxAfter: number;
}

function groupReviewsByCard(reviews: readonly StreakReview[]): Map<string, StreakReview[]> {
  const byCard = new Map<string, StreakReview[]>();

  for (const review of reviews) {
    const forCard = byCard.get(review.cardId);

    if (forCard) forCard.push(review);
    else byCard.set(review.cardId, [review]);
  }

  for (const forCard of byCard.values())
    forCard.sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());

  return byCard;
}

/**
 * The Berlin day a Card is next due, as reconstructed from its Review history as of `day`: the
 * box and timestamp of its last Review on or before `day`, or its creation if it has none.
 */
function dueDayForCard(
  card: StreakCard,
  reviewHistory: readonly StreakReview[],
  day: string,
): string {
  let dueDay = toBerlinDay(card.createdAt);

  for (const review of reviewHistory) {
    const reviewedDay = toBerlinDay(review.reviewedAt);

    if (reviewedDay > day) break;
    dueDay = shiftCalendarDay(reviewedDay, getIntervalDays(review.boxAfter));
  }

  return dueDay;
}

function isCardDueOnDay(
  card: StreakCard,
  reviewHistory: readonly StreakReview[],
  day: string,
): boolean {
  if (toBerlinDay(card.createdAt) > day) return false; // created after day: drops out
  if (card.deletedAt && toBerlinDay(card.deletedAt) < day) return false; // deleted before day: drops out

  return dueDayForCard(card, reviewHistory, day) <= day;
}

function anyCardDueOnDay(
  cards: readonly StreakCard[],
  reviewsByCard: Map<string, StreakReview[]>,
  day: string,
): boolean {
  return cards.some((card) => isCardDueOnDay(card, reviewsByCard.get(card.id) ?? [], day));
}

/**
 * The number of consecutive Berlin calendar days, walking back from `now`, on which the Learner
 * completed at least one Exercise. A rest day — one on which no Card was due — is passed over: it
 * neither extends nor breaks the Streak. A day on which a Card was due but nothing was reviewed
 * stops the walk. The still-unfinished current day is exempt from breaking it.
 *
 * Pure and stateless by design (see ADR-0008): every call reconstructs the Streak from the Review
 * log plus each Card's creation and deletion, with nothing stored in between.
 */
export function calculateStreak(
  cards: readonly StreakCard[],
  reviews: readonly StreakReview[],
  now: Date,
): number {
  if (cards.length === 0) return 0;

  const reviewedDays = new Set(reviews.map((review) => toBerlinDay(review.reviewedAt)));
  const reviewsByCard = groupReviewsByCard(reviews);
  // The walk never needs to look earlier than the oldest fact on record. It is usually a Card's
  // creation, but an offline Review can in principle be recorded against a Card created the same
  // day and answered a little earlier in wall-clock terms, so both kinds of day are candidates.
  const earliestDay = [...cards.map((card) => toBerlinDay(card.createdAt)), ...reviewedDays].reduce(
    (earliest, day) => (day < earliest ? day : earliest),
  );

  let streak = 0;
  let day = toBerlinDay(now);
  let isCurrentDay = true;

  while (day >= earliestDay) {
    if (reviewedDays.has(day)) streak += 1;
    else if (!isCurrentDay && anyCardDueOnDay(cards, reviewsByCard, day)) break;

    isCurrentDay = false;
    day = shiftCalendarDay(day, -1);
  }

  return streak;
}
