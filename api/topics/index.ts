import { createTopicInputSchema } from "../../src/contracts/topic.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { createTopic, listTopics } from "../../src/server/resources/topics.js";

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, { protected: true, cacheControl: "private, no-cache" }, async () =>
    Response.json(await listTopics()),
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: createTopicInputSchema },
    async ({ body }) => Response.json(await createTopic(body), { status: 201 }),
  );
}
