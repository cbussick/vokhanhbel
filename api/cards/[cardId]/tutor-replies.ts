import { z } from "zod";
import { tutorInputSchema } from "../../../src/contracts/tutor.js";
import { problemTypes } from "../../../src/contracts/problem.js";
import { createOpenAiProvider } from "../../../src/server/ai/aiProvider.js";
import { handleRequest } from "../../../src/server/http/handler.js";
import { AppProblem } from "../../../src/server/http/problem.js";
import { createTutorStream } from "../../../src/server/resources/tutor.js";

function getCardId(request: Request): string {
  const value = new URL(request.url).pathname.split("/").filter(Boolean).at(-2);
  const result = z.uuid().safeParse(value);

  if (!result.success) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");

  return result.data;
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: tutorInputSchema },
    async ({ body, sessionHash }) =>
      createTutorStream(
        getCardId(request),
        body,
        sessionHash!,
        createOpenAiProvider(),
        request.signal,
      ),
  );
}
