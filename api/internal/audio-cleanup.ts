import { timingSafeEqual } from "node:crypto";
import { problemTypes } from "../../src/contracts/problem.js";
import { getServerEnvironment } from "../../src/server/config/environment.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { AppProblem } from "../../src/server/http/problem.js";
import { cleanupExpiredAudio, retryAudioCleanup } from "../../src/server/resources/audio.js";

function hasCronAuthorization(request: Request): boolean {
  const secret = getServerEnvironment().CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const received = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(secret);
  const receivedBytes = Buffer.from(received);

  return (
    expectedBytes.byteLength === receivedBytes.byteLength &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, {}, async () => {
    if (!hasCronAuthorization(request))
      throw new AppProblem(401, problemTypes.unauthenticated, "Anmeldung erforderlich");
    const expired = await cleanupExpiredAudio();
    const retried = await retryAudioCleanup();

    return Response.json({ expired, retried });
  });
}
