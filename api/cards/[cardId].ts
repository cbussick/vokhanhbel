import { z } from "zod";
import { updateCardInputSchema } from "../../src/contracts/card";
import { problemTypes } from "../../src/contracts/problem";
import { handleRequest } from "../../src/server/http/handler";
import { AppProblem } from "../../src/server/http/problem";
import { deleteCard, getCard, updateCard } from "../../src/server/resources/cards";

function getCardId(request: Request): string {
  const value = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  const result = z.uuid().safeParse(value);

  if (!result.success) throw new AppProblem(404, problemTypes.cardNotFound, "Karte nicht gefunden");

  return result.data;
}

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, { protected: true, cacheControl: "private, no-cache" }, async () =>
    Response.json(await getCard(getCardId(request))),
  );
}

export async function PATCH(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: updateCardInputSchema },
    async ({ body }) => Response.json(await updateCard(getCardId(request), body)),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request, { unsafe: true, protected: true }, async () => {
    await deleteCard(getCardId(request));

    return new Response(null, { status: 204 });
  });
}
