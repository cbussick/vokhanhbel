import { z } from "zod";
import { khunhphapInputSchema } from "../../../src/contracts/khunhphap";
import { problemTypes } from "../../../src/contracts/problem";
import { createOpenAiProvider } from "../../../src/server/ai/aiProvider";
import { handleRequest } from "../../../src/server/http/handler";
import { AppProblem } from "../../../src/server/http/problem";
import { createKhunhphapStream } from "../../../src/server/resources/khunhphap";

function getCardId(request: Request): string {
  const value = new URL(request.url).pathname.split("/").filter(Boolean).at(-2);
  const result = z.uuid().safeParse(value);

  if (!result.success) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");

  return result.data;
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: khunhphapInputSchema },
    async ({ body, sessionHash }) =>
      createKhunhphapStream(
        getCardId(request),
        body,
        sessionHash!,
        createOpenAiProvider(),
        request.signal,
      ),
  );
}
