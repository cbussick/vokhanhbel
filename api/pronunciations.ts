import { pronunciationInputSchema } from "../src/contracts/pronunciation.js";
import { handleRequest } from "../src/server/http/handler.js";
import { cleanupExpiredAudio, enforceAudioUploadRateLimit } from "../src/server/resources/audio.js";
import { generatePronunciation } from "../src/server/resources/pronunciations.js";
import { getSpeechProvider } from "../src/server/tts/speechProvider.js";

export async function POST(request: Request): Promise<Response> {
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
