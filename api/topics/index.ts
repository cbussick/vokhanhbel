// One file on purpose: Vercel Hobby allows 12 serverless functions, and each api/**/*.ts
// file is one function. A second Topics route (index + [topicId], like Cards) is what
// broke the preview deploy. Item URLs still use /api/topics/:id; vercel.json rewrites
// them here.
import { z } from "zod";
import { problemTypes } from "../../src/contracts/problem.js";
import { createTopicInputSchema, topicInputSchema } from "../../src/contracts/topic.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { AppProblem } from "../../src/server/http/problem.js";
import {
  createTopic,
  deleteTopic,
  listTopics,
  updateTopic,
} from "../../src/server/resources/topics.js";

function topicIdFrom(request: Request): string | undefined {
  const url = new URL(request.url);
  const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);
  const raw =
    url.searchParams.get("topicId") ??
    (lastSegment && lastSegment !== "topics" ? lastSegment : undefined);

  if (!raw) return undefined;
  const result = z.uuid().safeParse(raw);

  if (!result.success)
    throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

  return result.data;
}

function requireTopicId(request: Request): string {
  const topicId = topicIdFrom(request);

  if (!topicId) throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

  return topicId;
}

export async function GET(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { protected: true, cacheControl: "private, no-cache" },
    async () => {
      if (topicIdFrom(request))
        throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

      return Response.json(await listTopics());
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: createTopicInputSchema },
    async ({ body }) => {
      if (topicIdFrom(request))
        throw new AppProblem(404, problemTypes.topicNotFound, "Thema nicht gefunden");

      return Response.json(await createTopic(body), { status: 201 });
    },
  );
}

export async function PATCH(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: topicInputSchema },
    async ({ body }) => Response.json(await updateTopic(requireTopicId(request), body)),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request, { unsafe: true, protected: true }, async () => {
    await deleteTopic(requireTopicId(request));

    return new Response(null, { status: 204 });
  });
}
