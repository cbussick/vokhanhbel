import { z } from "zod";
import { statsSchema, type Stats } from "../../contracts/stats";
import { berlinTimeZone } from "../../domain/time";
import { getPool } from "../database/client";

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
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: berlinTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const recap = recent.rows[0] ? dayRowSchema.parse(recent.rows[0]) : undefined;

  return statsSchema.parse({
    totalPoints: Number(row.total_points),
    activeCardCount: Number(row.active_card_count),
    reviewsThisWeek: Number(row.reviews_this_week),
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
