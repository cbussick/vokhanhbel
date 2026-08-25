import { z } from "zod";
import { problemTypes } from "../../contracts/problem.js";
import type { TutorExerciseCard, TutorInput } from "../../contracts/tutor.js";
import { berlinTimeZone } from "../../domain/time.js";
import type { AiProvider, TutorProviderRequest } from "../ai/aiProvider.js";
import { getPool } from "../database/client.js";
import { AppProblem } from "../http/problem.js";
import { getCard } from "./cards.js";

const allowanceCountSchema = z.object({
  session_count: z.string().regex(/^\d+$/u),
  daily_count: z.string().regex(/^\d+$/u),
  session_retry: z.string().regex(/^\d+(?:\.\d+)?$/u),
  daily_retry: z.string().regex(/^\d+(?:\.\d+)?$/u),
});
const usageRetentionInterval = "2 days";
const sessionAllowanceInterval = "15 minutes";
const sessionAllowanceSeconds = 15 * 60;
const sessionRequestLimit = 60;
const dailyRequestLimit = 200;
const requestTimeoutMilliseconds = 60_000;

export async function consumeTutorAllowance(sessionHash: string): Promise<void> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('tutor-global', 0))`);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [sessionHash]);
    await client.query("DELETE FROM ai_usage WHERE used_at < now() - $1::interval", [
      usageRetentionInterval,
    ]);
    const counts = await client.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE session_hash=$1 AND used_at >= now() - $3::interval) AS session_count,
        COUNT(*) FILTER (WHERE used_at >= date_trunc('day', now() AT TIME ZONE $2::text) AT TIME ZONE $2::text) AS daily_count,
        COALESCE(EXTRACT(EPOCH FROM (MIN(used_at) FILTER (WHERE session_hash=$1 AND used_at >= now() - $3::interval) + $3::interval - now())), $4::numeric) AS session_retry,
        EXTRACT(EPOCH FROM (((date_trunc('day', now() AT TIME ZONE $2::text) + interval '1 day') AT TIME ZONE $2::text) - now())) AS daily_retry
      FROM ai_usage
    `,
      [sessionHash, berlinTimeZone, sessionAllowanceInterval, sessionAllowanceSeconds],
    );
    const count = allowanceCountSchema.parse(counts.rows[0]);

    if (Number(count.session_count) >= sessionRequestLimit)
      throw new AppProblem(
        429,
        problemTypes.tutorSessionLimit,
        "Tutopher braucht eine Pause",
        undefined,
        undefined,
        Number(count.session_retry),
      );
    if (Number(count.daily_count) >= dailyRequestLimit)
      throw new AppProblem(
        429,
        problemTypes.tutorDailyLimit,
        "Tutopher hat für heute Feierabend",
        undefined,
        undefined,
        Number(count.daily_retry),
      );
    await client.query("INSERT INTO ai_usage (session_hash) VALUES ($1)", [sessionHash]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Everything the client asserts about the resolved Exercise: which Card the dialog is anchored to,
 * every Card the Exercise covered with its Grade (null for a flip Card's self-graded outcome), and
 * the option text the Learner chose (null for a flip Card, which has none).
 */
export interface TutorExerciseInput {
  subjectCardId: string;
  exerciseCards: TutorExerciseCard[];
  chosenOptionText: string | null;
}

export async function createTutorStream(
  exercise: TutorExerciseInput,
  input: TutorInput,
  sessionHash: string,
  provider: AiProvider,
  requestSignal: AbortSignal,
): Promise<Response> {
  const subjectCard = await getCard(exercise.subjectCardId);

  if (!subjectCard.front.text || !subjectCard.back.text)
    throw new AppProblem(
      422,
      problemTypes.tutorAudioUnsupported,
      "Tutopher kann Audio nicht anhören",
    );

  const exerciseCards = await Promise.all(
    exercise.exerciseCards.map(async (exerciseCard) => {
      const card =
        exerciseCard.cardId === exercise.subjectCardId
          ? subjectCard
          : await getCard(exerciseCard.cardId);

      return { front: card.front.text, back: card.back.text, outcome: exerciseCard.outcome };
    }),
  );

  await consumeTutorAllowance(sessionHash);

  return createTutorResponse(
    {
      subjectCard: { front: subjectCard.front.text, back: subjectCard.back.text },
      exerciseCards,
      chosenOptionText: exercise.chosenOptionText,
    },
    input,
    provider,
    requestSignal,
  );
}

export function createTutorResponse(
  exercise: Omit<TutorProviderRequest, "input" | "signal">,
  input: TutorInput,
  provider: AiProvider,
  requestSignal: AbortSignal,
): Response {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(requestTimeoutMilliseconds)]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        for await (const event of provider.streamTutorReply({ ...exercise, input, signal })) {
          if (event.type === "delta") send("delta", { text: event.text });
          else send("done", { truncated: event.truncated });
        }
      } catch {
        send("error", { type: problemTypes.tutorFailed });
      } finally {
        controller.close();
      }
    },
    cancel() {
      /* request signal aborts the provider */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
