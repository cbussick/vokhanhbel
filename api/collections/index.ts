import { collectionInputSchema } from "../../src/contracts/collection.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { createCollection, listCollections } from "../../src/server/resources/collections.js";

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, { protected: true, cacheControl: "private, no-cache" }, async () =>
    Response.json(await listCollections()),
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: collectionInputSchema },
    async ({ body }) => Response.json(await createCollection(body), { status: 201 }),
  );
}
