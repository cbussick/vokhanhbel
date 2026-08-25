import { describe, expect, it } from "vitest";
import { calculateStreak, type StreakCard, type StreakReview } from "./streak.js";

// A fixed "now" mid-day Berlin time, well clear of any calendar-day boundary.
const now = new Date("2026-08-25T10:00:00.000Z");

function berlin(day: string, time = "10:00:00"): Date {
  return new Date(`${day}T${time}.000Z`);
}

function card(id: string, createdDay: string, deletedDay: string | null = null): StreakCard {
  return { id, createdAt: berlin(createdDay), deletedAt: deletedDay ? berlin(deletedDay) : null };
}

function review(cardId: string, day: string, boxAfter: number): StreakReview {
  return { cardId, reviewedAt: berlin(day), boxAfter };
}

describe("calculateStreak", () => {
  it("counts consecutive days that each had at least one Review", () => {
    const cards = [card("c1", "2026-08-20")];
    const reviews = [
      review("c1", "2026-08-21", 0),
      review("c1", "2026-08-22", 0),
      review("c1", "2026-08-23", 0),
      review("c1", "2026-08-24", 0),
      review("c1", "2026-08-25", 0),
    ];

    expect(calculateStreak(cards, reviews, now)).toBe(5);
  });

  it("stops walking back at the first day that breaks the Streak", () => {
    // Box 0 has a 1-day interval, so each review below leaves the Card due the next day.
    const cards = [card("c1", "2026-08-19")];
    const reviews = [
      review("c1", "2026-08-20", 0), // due 2026-08-21
      review("c1", "2026-08-21", 0), // due 2026-08-22 — nothing is reviewed that day, so it breaks
      review("c1", "2026-08-23", 0), // would extend the Streak if the walk reached it, but it can't
      review("c1", "2026-08-24", 0),
    ];

    // 2026-08-24 and 2026-08-23 count; 2026-08-22 breaks the Streak, so 2026-08-21 and 2026-08-20
    // are never reached even though they also hold Reviews.
    expect(calculateStreak(cards, reviews, now)).toBe(2);
  });

  it("passes over a gap day on which no Card was due", () => {
    const cards = [card("c1", "2026-08-22")];
    const reviews = [
      // Box 1 has a 3-day interval, so this leaves nothing due again until 2026-08-25.
      review("c1", "2026-08-22", 1),
      review("c1", "2026-08-25", 1),
    ];

    // 2026-08-23 and 2026-08-24 are rest days: nothing was due, so they neither extend nor break.
    expect(calculateStreak(cards, reviews, now)).toBe(2);
  });

  it("breaks the Streak on a day Cards were due but nothing was reviewed", () => {
    const cards = [card("c1", "2026-08-23")]; // created due, never reviewed
    const reviews = [review("c1", "2026-08-25", 0)];

    // 2026-08-25 counts; 2026-08-24 had the never-reviewed Card due and breaks the walk there.
    expect(calculateStreak(cards, reviews, now)).toBe(1);
  });

  it("breaks a gap day when a Card created during the gap goes unreviewed", () => {
    const cards = [
      card("c1", "2026-08-15"),
      card("c2", "2026-08-24"), // created during what would otherwise be a rest day, never reviewed
    ];
    const reviews = [
      // Box 2 has a 7-day interval, so c1 is never due again inside this window.
      review("c1", "2026-08-23", 2),
      review("c1", "2026-08-25", 2),
    ];

    // Without c2, 2026-08-24 would be a rest day and the Streak would reach 2026-08-23 too.
    // c2 is due the moment it is created, so it breaks the Streak at 2026-08-24 instead.
    expect(calculateStreak(cards, reviews, now)).toBe(1);
  });

  it("drops a Card deleted during the gap out of the due reconstruction", () => {
    const cards = [
      card("c1", "2026-08-15"),
      // Would be due every day from its creation onward, but is deleted before the gap day.
      card("c2", "2026-08-10", "2026-08-23"),
    ];
    const reviews = [
      review("c1", "2026-08-23", 2), // 7-day interval, never due again in this window
      review("c1", "2026-08-25", 2),
    ];

    // c2 is deleted before 2026-08-24, so it drops out and 2026-08-24 stays a rest day.
    expect(calculateStreak(cards, reviews, now)).toBe(2);
  });

  it("credits a Review by the day the Learner answered, not any other timestamp", () => {
    const cards = [card("c1", "2026-08-20")];
    // The pure derivation only ever receives `reviewedAt` — an offline Session synced later still
    // credits the day it was answered because there is no server-recorded timestamp to read here.
    const reviews = [review("c1", "2026-08-24", 0), review("c1", "2026-08-25", 0)];

    expect(calculateStreak(cards, reviews, now)).toBe(2);
  });

  it("never lets the still-unfinished current day break the Streak", () => {
    const cards = [card("c1", "2026-08-23")]; // due immediately, never reviewed today
    const reviews: StreakReview[] = [];

    // Today (2026-08-25) has a Card due and nothing reviewed yet, but the day isn't over, so it is
    // passed over rather than breaking the Streak. Walking further back does find the break.
    expect(calculateStreak(cards, reviews, now)).toBe(0);
  });

  it("returns zero for a Learner with no history at all", () => {
    expect(calculateStreak([], [], now)).toBe(0);
  });

  it("returns zero for a Learner whose Cards have never been reviewed", () => {
    const cards = [card("c1", "2026-08-01")];

    expect(calculateStreak(cards, [], now)).toBe(0);
  });
});
