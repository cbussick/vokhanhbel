import { reviewSubmissionInputSchema } from "../src/contracts/review.js";
import { handleRequest } from "../src/server/http/handler.js";
import { recordReview } from "../src/server/resources/reviews.js";

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, protected: true, bodySchema: reviewSubmissionInputSchema },
    async ({ body }) => Response.json(await recordReview(body)),
  );
}
