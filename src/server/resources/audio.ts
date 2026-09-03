import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { audioMetadataSchema, type AudioMetadata } from "../../contracts/card.js";
import { problemTypes } from "../../contracts/problem.js";
import { getAudioObjectStore, type AudioObjectRange } from "../audio/audioObjectStore.js";
import type { AudioProvenance } from "../audio/audioProvenance.js";
import { inspectAudio } from "../audio/inspectAudio.js";
import { getDatabase, getPool } from "../database/client.js";
import { audioAssets, audioCleanupJobs, cards } from "../database/schema.js";
import { AppProblem } from "../http/problem.js";

const stagedLifetimeMilliseconds = 60 * 60 * 1_000;

function operationLog(
  operation: string,
  audioId: string,
  outcome: string,
  requestId?: string,
): void {
  console.info(
    JSON.stringify({
      area: "audio-storage",
      operation,
      audioId,
      outcome,
      ...(requestId ? { requestId } : {}),
    }),
  );
}

async function recordCleanupFailure(
  audioId: string,
  objectKey: string,
  reason: string,
  error: unknown,
  requestId?: string,
): Promise<void> {
  const message = error instanceof Error ? error.message.slice(0, 300) : "storage-error";

  await getDatabase()
    .insert(audioCleanupJobs)
    .values({ audioId, objectKey, reason, attempts: 1, lastError: message })
    .onConflictDoUpdate({
      target: audioCleanupJobs.audioId,
      set: { attempts: sql`${audioCleanupJobs.attempts} + 1`, lastError: message },
      targetWhere: isNull(audioCleanupJobs.completedAt),
    });
  operationLog("delete", audioId, "retry-scheduled", requestId);
}

export async function deleteAudioObject(
  audio: { id: string; objectKey: string },
  reason: string,
  requestId?: string,
): Promise<void> {
  try {
    await getAudioObjectStore().delete(audio.objectKey);
    operationLog("delete", audio.id, "deleted", requestId);
  } catch (error) {
    await recordCleanupFailure(audio.id, audio.objectKey, reason, error, requestId);
  }
}

const recordedColumns = {
  source: "recorded",
  speechProvider: null,
  speechVoice: null,
  speechLanguage: null,
  synthesizedText: null,
} as const;

export async function stageAudio(
  sessionHash: string,
  bytes: Uint8Array,
  provenance: AudioProvenance,
  suppliedContentType?: string,
  requestId?: string,
): Promise<AudioMetadata> {
  const inspected = await inspectAudio(bytes, suppliedContentType);
  const id = crypto.randomUUID();
  const objectKey = `audio/${id}`;

  await getAudioObjectStore().put(objectKey, bytes, inspected.contentType);
  operationLog("upload", id, "stored", requestId);

  try {
    const rows = await getDatabase()
      .insert(audioAssets)
      .values({
        id,
        objectKey,
        ownerSessionHash: sessionHash,
        contentType: inspected.contentType,
        codec: inspected.codec,
        byteSize: inspected.byteSize,
        durationMs: inspected.durationMs,
        checksum: inspected.checksum,
        stagedUntil: new Date(Date.now() + stagedLifetimeMilliseconds),
        ...(provenance.source === "generated" ? provenance : recordedColumns),
      })
      .returning();
    const row = rows[0]!;

    return audioMetadataSchema.parse({
      id: row.id,
      durationMs: row.durationMs,
      contentType: row.contentType,
      byteSize: row.byteSize,
      synthesizedText: row.synthesizedText,
    });
  } catch (error) {
    await deleteAudioObject({ id, objectKey }, "metadata-failure", requestId);
    throw error;
  }
}

function parseRange(rangeHeader: string | null, totalSize: number): AudioObjectRange | undefined {
  if (!rangeHeader) return undefined;
  const match = /^bytes=(\d+)-(\d*)$/u.exec(rangeHeader.trim());

  if (!match) throw new AppProblem(416, problemTypes.invalidAudioRange, "Audiobereich ungültig");
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;

  if (start >= totalSize || (end !== undefined && (end < start || end >= totalSize)))
    throw new AppProblem(416, problemTypes.invalidAudioRange, "Audiobereich ungültig");

  return { start, ...(end === undefined ? {} : { end }) };
}

export async function playAudio(
  audioId: string,
  sessionHash: string,
  rangeHeader: string | null,
  requestId?: string,
): Promise<Response> {
  const rows = await getDatabase()
    .select()
    .from(audioAssets)
    .where(and(eq(audioAssets.id, audioId), isNull(audioAssets.deletedAt)))
    .limit(1);
  const audio = rows[0];
  // A clip is audible once it sits on a Card, and before that only to the session that staged it,
  // so the Learner can hear a pronunciation she just generated without saving the Card first.
  // `stagedUntil` is deliberately not part of this: expiry is the sweep's job, exactly as it is for
  // claiming, so a clip that outlived its stage stays audible to its owner until the sweep takes it.
  const isAudible =
    audio && (audio.claimedCardId !== null || audio.ownerSessionHash === sessionHash);

  if (!isAudible) throw new AppProblem(404, problemTypes.audioNotFound, "Audio nicht gefunden");
  const range = parseRange(rangeHeader, audio.byteSize);
  const stored = await getAudioObjectStore().read(audio.objectKey, range);

  if (!stored) throw new AppProblem(404, problemTypes.audioNotFound, "Audio nicht gefunden");
  operationLog("range-read", audio.id, range ? "partial" : "complete", requestId);
  const headers = new Headers({
    "Content-Type": audio.contentType,
    "Content-Length": String(stored.bytes.byteLength),
    "Accept-Ranges": "bytes",
  });

  if (stored.contentRange) headers.set("Content-Range", stored.contentRange);

  return new Response(new Blob([Uint8Array.from(stored.bytes)]), {
    status: range ? 206 : 200,
    headers,
  });
}

export async function discardStagedAudio(
  audioId: string,
  sessionHash: string,
  requestId?: string,
): Promise<void> {
  const rows = await getDatabase()
    .update(audioAssets)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(audioAssets.id, audioId),
        eq(audioAssets.ownerSessionHash, sessionHash),
        isNull(audioAssets.claimedCardId),
        isNull(audioAssets.deletedAt),
      ),
    )
    .returning({ id: audioAssets.id, objectKey: audioAssets.objectKey });

  if (!rows[0]) throw new AppProblem(404, problemTypes.audioNotFound, "Audio nicht gefunden");
  await deleteAudioObject(rows[0], "discarded-stage", requestId);
}

export async function enforceAudioUploadRateLimit(sessionHash: string): Promise<void> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `audio-upload:${sessionHash}`,
    ]);
    await client.query(
      "DELETE FROM audio_upload_attempts WHERE attempted_at < now() - interval '1 hour'",
    );
    const result = await client.query(
      "SELECT count(*) FROM audio_upload_attempts WHERE session_hash=$1 AND attempted_at >= now() - interval '1 hour'",
      [sessionHash],
    );

    const count = z.object({ count: z.coerce.number().int().nonnegative() }).parse(result.rows[0]);

    if (count.count >= 30)
      throw new AppProblem(
        429,
        problemTypes.audioUploadRateLimit,
        "Zu viele Audio-Uploads. Versuch es später erneut.",
        undefined,
        undefined,
        60,
      );
    await client.query("INSERT INTO audio_upload_attempts (session_hash) VALUES ($1)", [
      sessionHash,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function enforceAudioPlaybackRateLimit(sessionHash: string): Promise<void> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `audio-playback:${sessionHash}`,
    ]);
    await client.query(
      "DELETE FROM audio_playback_attempts WHERE attempted_at < now() - interval '1 hour'",
    );
    const result = await client.query(
      "SELECT count(*) FROM audio_playback_attempts WHERE session_hash=$1 AND attempted_at >= now() - interval '1 hour'",
      [sessionHash],
    );
    const count = z.object({ count: z.coerce.number().int().nonnegative() }).parse(result.rows[0]);

    if (count.count >= 300)
      throw new AppProblem(
        429,
        problemTypes.audioPlaybackRateLimit,
        "Zu viele Audio-Anfragen. Versuch es später erneut.",
        undefined,
        undefined,
        60,
      );
    await client.query("INSERT INTO audio_playback_attempts (session_hash) VALUES ($1)", [
      sessionHash,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupExpiredAudio(now = new Date()): Promise<number> {
  const expired = await getDatabase()
    .update(audioAssets)
    .set({ deletedAt: now })
    .where(
      and(
        isNull(audioAssets.claimedCardId),
        isNull(audioAssets.deletedAt),
        lt(audioAssets.stagedUntil, now),
      ),
    )
    .returning({ id: audioAssets.id, objectKey: audioAssets.objectKey });

  await Promise.all(expired.map((audio) => deleteAudioObject(audio, "expired-stage")));
  if (expired.length) operationLog("expiry", "batch", String(expired.length));

  return expired.length;
}

export async function retryAudioCleanup(): Promise<number> {
  const jobs = await getDatabase()
    .select()
    .from(audioCleanupJobs)
    .where(isNull(audioCleanupJobs.completedAt));
  let completed = 0;

  for (const job of jobs) {
    const referenced = await getDatabase()
      .select({ id: cards.id })
      .from(cards)
      .where(
        and(
          isNull(cards.deletedAt),
          or(eq(cards.frontAudioId, job.audioId), eq(cards.backAudioId, job.audioId)),
        ),
      )
      .limit(1);

    if (referenced[0]) continue;

    try {
      await getAudioObjectStore().delete(job.objectKey);
      await getDatabase()
        .update(audioCleanupJobs)
        .set({ completedAt: new Date(), attempts: job.attempts + 1, lastError: null })
        .where(eq(audioCleanupJobs.id, job.id));
      completed += 1;
      operationLog("retry", job.audioId, "deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "storage-error";

      await getDatabase()
        .update(audioCleanupJobs)
        .set({ attempts: job.attempts + 1, lastError: message })
        .where(eq(audioCleanupJobs.id, job.id));
      operationLog("retry", job.audioId, "failed");
    }
  }

  return completed;
}
