import { z } from "zod";
import { updateCollectionInputSchema } from "../../src/contracts/collection.js";
import { problemTypes } from "../../src/contracts/problem.js";
import { handleRequest } from "../../src/server/http/handler.js";
import { AppProblem } from "../../src/server/http/problem.js";
import { deleteCollection, updateCollection } from "../../src/server/resources/collections.js";

function getCollectionId(request: Request): string {
  const value = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  const result = z.uuid().safeParse(value);

  if (!result.success)
    throw new AppProblem(404, problemTypes.collectionNotFound, "Sammlung nicht gefunden");

  return result.data;
}

export async function PATCH(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: updateCollectionInputSchema },
    async ({ body }) => Response.json(await updateCollection(getCollectionId(request), body)),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request, { unsafe: true, protected: true }, async () => {
    await deleteCollection(getCollectionId(request));

    return new Response(null, { status: 204 });
  });
}
