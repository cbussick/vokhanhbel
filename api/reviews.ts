import { reviewSubmissionInputSchema } from "../src/contracts/review";
import { handleRequest } from "../src/server/http/handler";
import { recordReview } from "../src/server/resources/reviews";

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: reviewSubmissionInputSchema },
    async ({ body }) => Response.json(await recordReview(body)),
  );
}
