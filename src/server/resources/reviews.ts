import { z } from "zod";
import { cardSchema } from "../../contracts/card.js";
import { problemTypes } from "../../contracts/problem.js";
import {
  reviewResultSchema,
  reviewSchema,
  type ReviewResult,
  type ReviewSubmissionInput,
} from "../../contracts/review.js";
import { berlinTimeZone } from "../../domain/time.js";
import {
  boxSchema,
  getBoxAfterGrade,
  getIntervalDays,
  getPointsForGrade,
  gradeSchema,
  type Box,
} from "../../domain/review.js";
import { getPool } from "../database/client.js";
import { AppProblem } from "../http/problem.js";
import { mapCard } from "./cardMapper.js";

const reviewRowSchema = z.object({
  id: z.uuid(),
  card_id: z.uuid(),
  grade: gradeSchema,
  points_awarded: z.number().int(),
  box_before: boxSchema,
  box_after: boxSchema,
  reviewed_at: z.date(),
  recorded_at: z.date(),
  result_card: cardSchema,
});

const databaseCardRowSchema = z.object({
  id: z.uuid(),
  front: z.string(),
  back: z.string(),
  box: boxSchema,
  due_at: z.date(),
  last_reviewed_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

const dueRowSchema = z.object({ due_at: z.date() });
const maximumReviewAgeMilliseconds = 7 * 24 * 60 * 60 * 1_000;
const maximumClockSkewMilliseconds = 5 * 60 * 1_000;

function mapDatabaseCard(value: unknown) {
  const row = databaseCardRowSchema.parse(value);

  return mapCard({
    id: row.id,
    front: row.front,
    back: row.back,
    box: row.box,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

function mapReview(value: unknown) {
  const row = reviewRowSchema.parse(value);

  return reviewSchema.parse({
    id: row.id,
    cardId: row.card_id,
    grade: row.grade,
    pointsAwarded: row.points_awarded,
    boxBefore: row.box_before,
    boxAfter: row.box_after,
    reviewedAt: row.reviewed_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
  });
}

export async function recordReview(input: ReviewSubmissionInput): Promise<ReviewResult> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [input.id]);
    const replay = await client.query("SELECT * FROM reviews WHERE id = $1", [input.id]);

    if (replay.rows[0]) {
      const original = reviewRowSchema.parse(replay.rows[0]);

      if (
        original.card_id !== input.cardId ||
        original.grade !== input.grade ||
        original.reviewed_at.toISOString() !== input.reviewedAt
      ) {
        throw new AppProblem(
          409,
          problemTypes.reviewReplayConflict,
          "Review muss neu geladen werden",
        );
      }

      await client.query("COMMIT");

      return reviewResultSchema.parse({
        review: mapReview(original),
        card: original.result_card,
      });
    }

    const cardResult = await client.query("SELECT * FROM cards WHERE id = $1 FOR UPDATE", [
      input.cardId,
    ]);
    const card = cardResult.rows[0] ? databaseCardRowSchema.parse(cardResult.rows[0]) : undefined;

    if (!card || card.deleted_at)
      throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");
    const reviewedAt = new Date(input.reviewedAt);
    const now = new Date();

    if (reviewedAt.getTime() < now.getTime() - maximumReviewAgeMilliseconds)
      throw new AppProblem(422, problemTypes.reviewTooOld, "Review ist zu alt");
    if (reviewedAt.getTime() > now.getTime() + maximumClockSkewMilliseconds)
      throw new AppProblem(422, problemTypes.deviceClockAhead, "Gerätezeit prüfen");

    const boxBefore = card.box as Box;
    const boxAfter = getBoxAfterGrade(boxBefore, input.grade);
    const pointsAwarded = getPointsForGrade(input.grade);
    const intervalDays = getIntervalDays(boxAfter);
    const dueResult = await client.query(
      `SELECT ((date_trunc('day', $1::timestamptz AT TIME ZONE $3::text) + ($2::text || ' days')::interval) AT TIME ZONE $3::text) AS due_at`,
      [reviewedAt, intervalDays, berlinTimeZone],
    );
    const dueAt = dueRowSchema.parse(dueResult.rows[0]).due_at;
    const updated = await client.query(
      "UPDATE cards SET box=$1, due_at=$2, last_reviewed_at=$3, updated_at=now() WHERE id=$4 RETURNING *",
      [boxAfter, dueAt, reviewedAt, input.cardId],
    );
    const resultingCard = mapDatabaseCard(updated.rows[0]);
    const inserted = await client.query(
      "INSERT INTO reviews (id, card_id, grade, points_awarded, box_before, box_after, reviewed_at, result_card) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *",
      [
        input.id,
        input.cardId,
        input.grade,
        pointsAwarded,
        boxBefore,
        boxAfter,
        reviewedAt,
        JSON.stringify(resultingCard),
      ],
    );
    await client.query("COMMIT");

    return reviewResultSchema.parse({
      review: mapReview(inserted.rows[0]),
      card: resultingCard,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
