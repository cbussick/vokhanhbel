import { tutorInputSchema } from "../src/contracts/tutor.js";
import { createOpenAiProvider } from "../src/server/ai/aiProvider.js";
import { handleRequest } from "../src/server/http/handler.js";
import { createTutorStream } from "../src/server/resources/tutor.js";

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: tutorInputSchema },
    async ({ body, sessionHash }) =>
      createTutorStream(body, body, sessionHash!, createOpenAiProvider(), request.signal),
  );
}
