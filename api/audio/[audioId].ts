import { z } from "zod";
import { problemTypes } from "../../src/contracts/problem.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { AppProblem } from "../../src/server/http/problem.js";
import { discardStagedAudio, playAudio } from "../../src/server/resources/audio.js";

function getAudioId(request: Request): string {
  const segment = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  const result = z.uuid().safeParse(segment);

  if (!result.success)
    throw new AppProblem(404, problemTypes.audioNotFound, "Audio nicht gefunden");

  return result.data;
}

export async function GET(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { protected: true, cacheControl: "private, max-age=3600" },
    async ({ requestId }) =>
      playAudio(getAudioId(request), request.headers.get("range"), requestId),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true },
    async ({ sessionHash, requestId }) => {
      await discardStagedAudio(getAudioId(request), sessionHash!, requestId);

      return new Response(null, { status: 204 });
    },
  );
}
