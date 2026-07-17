import { handleRequest } from "../src/server/http/handler";
import { getStats } from "../src/server/resources/stats";

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, { protected: true, cacheControl: "private, no-cache" }, async () =>
    Response.json(await getStats()),
  );
}
