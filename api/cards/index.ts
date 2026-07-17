import { createCardInputSchema } from "../../src/contracts/card.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { createCard, listCards } from "../../src/server/resources/cards.js";

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, { protected: true, cacheControl: "private, no-cache" }, async () =>
    Response.json(await listCards()),
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: createCardInputSchema },
    async ({ body }) => Response.json(await createCard(body), { status: 201 }),
  );
}
