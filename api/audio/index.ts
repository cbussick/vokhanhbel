import { maximumAudioBytes } from "../../src/contracts/card.js";
import { problemTypes } from "../../src/contracts/problem.js";
import { pronunciationInputSchema } from "../../src/contracts/pronunciation.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { AppProblem } from "../../src/server/http/problem.js";
import {
  cleanupExpiredAudio,
  enforceAudioUploadRateLimit,
  stageAudio,
} from "../../src/server/resources/audio.js";
import { generatePronunciation } from "../../src/server/resources/pronunciations.js";
import { getSpeechProvider } from "../../src/server/speech/speechProvider.js";

async function readLimitedBody(request: Request): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  const chunkStream: AsyncIterable<Uint8Array> = request.body;

  for await (const value of chunkStream) {
    byteLength += value.byteLength;
    if (byteLength > maximumAudioBytes) {
      throw new AppProblem(413, problemTypes.requestTooLarge, "Audiodatei ist zu groß");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

function uploadRecording(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true },
    async ({ sessionHash, requestId }) => {
      const contentLength = Number(request.headers.get("content-length") ?? 0);

      if (contentLength > maximumAudioBytes)
        throw new AppProblem(413, problemTypes.requestTooLarge, "Audiodatei ist zu groß");
      await enforceAudioUploadRateLimit(sessionHash!);
      const bytes = await readLimitedBody(request);
      await cleanupExpiredAudio();

      return Response.json(
        await stageAudio(
          sessionHash!,
          bytes,
          { source: "recorded" },
          request.headers.get("content-type") ?? undefined,
          requestId,
        ),
        { status: 201 },
      );
    },
  );
}

function generateClip(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: pronunciationInputSchema },
    async ({ body, sessionHash, requestId }) => {
      // Generation stages an audio asset the same way an upload does, so it draws on the same
      // allowance rather than opening a second, unmetered way to create one.
      await enforceAudioUploadRateLimit(sessionHash!);
      await cleanupExpiredAudio();

      return Response.json(
        await generatePronunciation(sessionHash!, body, getSpeechProvider(), requestId),
        { status: 201 },
      );
    },
  );
}

/**
 * Both ways of creating a staged Clip share one function file, because the plan allows twelve and
 * `api/` already holds twelve — see the serverless function budget in `docs/deployment-strategy.md`.
 * `vercel.json` rewrites `/api/pronunciations` onto this route with the marker below, exactly as it
 * already rewrites `/api/topics/:topicId`, so each way keeps its own path and its own body.
 */
export async function POST(request: Request): Promise<Response> {
  const isPronunciation = new URL(request.url).searchParams.has("pronunciation");

  return isPronunciation ? generateClip(request) : uploadRecording(request);
}
