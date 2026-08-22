import { z } from "zod";
import { topicInputSchema } from "../../src/contracts/topic.js";
import { problemTypes } from "../../src/contracts/problem.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { AppProblem } from "../../src/server/http/problem.js";
import { deleteTopic, updateTopic } from "../../src/server/resources/topics.js";

function getTopicId(request: Request): string {
  const value = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  const result = z.uuid().safeParse(value);

  if (!result.success) throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

  return result.data;
}

export async function PATCH(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: topicInputSchema },
    async ({ body }) => Response.json(await updateTopic(getTopicId(request), body)),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request, { unsafe: true, protected: true }, async () => {
    await deleteTopic(getTopicId(request));

    return new Response(null, { status: 204 });
  });
}
