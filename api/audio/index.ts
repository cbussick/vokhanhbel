import { problemTypes } from "../../src/contracts/problem.js";
import { maximumAudioBytes } from "../../src/server/audio/inspectAudio.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { AppProblem } from "../../src/server/http/problem.js";
import {
  cleanupExpiredAudio,
  enforceAudioUploadRateLimit,
  stageAudio,
} from "../../src/server/resources/audio.js";

async function readLimitedBody(request: Request): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  for await (const value of request.body as unknown as AsyncIterable<Uint8Array>) {
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

export async function POST(request: Request): Promise<Response> {
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
          request.headers.get("content-type") ?? undefined,
          requestId,
        ),
        { status: 201 },
      );
    },
  );
}
