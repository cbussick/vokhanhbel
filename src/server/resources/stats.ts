import { z } from "zod";
import { statsSchema, type Stats } from "../../contracts/stats.js";
import { boxSchema } from "../../domain/review.js";
import { calculateStreak } from "../../domain/streak.js";
import { berlinTimeZone, toBerlinDay } from "../../domain/time.js";
import { getPool } from "../database/client.js";

const databaseNumberSchema = z.union([z.number(), z.string().regex(/^\d+$/u)]);

const statsRowSchema = z.object({
  total_points: databaseNumberSchema,
  active_card_count: databaseNumberSchema,
  reviews_this_week: databaseNumberSchema,
});

const dayRowSchema = z.object({
  date: z.iso.date(),
  review_count: databaseNumberSchema,
  knew_it_count: databaseNumberSchema,
});

const streakCardRowSchema = z.object({
  id: z.uuid(),
  created_at: z.date(),
  deleted_at: z.date().nullable(),
});

const streakReviewRowSchema = z.object({
  card_id: z.uuid(),
  reviewed_at: z.date(),
  box_after: boxSchema,
});

async function getCurrentStreak(): Promise<number> {
  const cardRows = await getPool().query("SELECT id, created_at, deleted_at FROM cards");
  const reviewRows = await getPool().query("SELECT card_id, reviewed_at, box_after FROM reviews");

  const cards = cardRows.rows.map((row) => {
    const parsed = streakCardRowSchema.parse(row);

    return { id: parsed.id, createdAt: parsed.created_at, deletedAt: parsed.deleted_at };
  });
  const reviews = reviewRows.rows.map((row) => {
    const parsed = streakReviewRowSchema.parse(row);

    return { cardId: parsed.card_id, reviewedAt: parsed.reviewed_at, boxAfter: parsed.box_after };
  });

  return calculateStreak(cards, reviews, new Date());
}

export async function getStats(): Promise<Stats> {
  const summary = await getPool().query(
    `
    SELECT
      COALESCE((SELECT SUM(points_awarded) FROM reviews), 0) AS total_points,
      (SELECT COUNT(*) FROM cards WHERE deleted_at IS NULL) AS active_card_count,
      (SELECT COUNT(*) FROM reviews WHERE reviewed_at >= date_trunc('week', now() AT TIME ZONE $1::text) AT TIME ZONE $1::text) AS reviews_this_week
  `,
    [berlinTimeZone],
  );
  const best = await getPool().query(
    `
    SELECT (reviewed_at AT TIME ZONE $1::text)::date::text AS date, COUNT(*) AS review_count, COUNT(*) FILTER (WHERE grade='knew_it') AS knew_it_count
    FROM reviews GROUP BY 1 ORDER BY review_count DESC, date DESC LIMIT 1
  `,
    [berlinTimeZone],
  );
  const recent = await getPool().query(
    `
    SELECT (reviewed_at AT TIME ZONE $1::text)::date::text AS date, COUNT(*) AS review_count, COUNT(*) FILTER (WHERE grade='knew_it') AS knew_it_count
    FROM reviews
    WHERE (reviewed_at AT TIME ZONE $1::text)::date IN ((now() AT TIME ZONE $1::text)::date, (now() AT TIME ZONE $1::text)::date - 1)
    GROUP BY 1 ORDER BY date DESC
  `,
    [berlinTimeZone],
  );
  const row = statsRowSchema.parse(summary.rows[0]);
  const bestDay = best.rows[0] ? dayRowSchema.parse(best.rows[0]) : undefined;
  const today = toBerlinDay(new Date());
  const recap = recent.rows[0] ? dayRowSchema.parse(recent.rows[0]) : undefined;
  const currentStreak = await getCurrentStreak();

  return statsSchema.parse({
    totalPoints: Number(row.total_points),
    activeCardCount: Number(row.active_card_count),
    reviewsThisWeek: Number(row.reviews_this_week),
    currentStreak,
    bestDay: bestDay ? { date: bestDay.date, reviewCount: Number(bestDay.review_count) } : null,
    dailyRecap: recap
      ? {
          period: recap.date === today ? "today" : "yesterday",
          date: recap.date,
          reviewCount: Number(recap.review_count),
          knewItCount: Number(recap.knew_it_count),
        }
      : null,
  });
}
