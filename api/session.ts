import { loginInputSchema } from "../src/contracts/session";
import { getAuthenticatedSessionHash, revokeCurrentSession } from "../src/server/auth/session";
import { clearSessionCookie, createSessionCookie } from "../src/server/http/cookies";
import { handleRequest } from "../src/server/http/handler";
import { login } from "../src/server/resources/sessions";

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, { cacheControl: "no-store" }, async () =>
    Response.json({ authenticated: Boolean(await getAuthenticatedSessionHash(request)) }),
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(
    request,
    { unsafe: true, bodySchema: loginInputSchema },
    async ({ body }) => {
      const identifier = await login(request, body);

      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": createSessionCookie(identifier) },
      });
    },
  );
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request, { unsafe: true, protected: true }, async () => {
    await revokeCurrentSession(request);

    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": clearSessionCookie(),
        "Clear-Site-Data": '"cache", "cookies", "storage"',
      },
    });
  });
}
