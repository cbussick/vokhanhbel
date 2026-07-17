import type { ZodType } from "zod";
import { problemTypes } from "../../contracts/problem";
import { getAuthenticatedSessionHash } from "../auth/session";
import { isAllowedUnsafeRequest } from "./origin";
import { AppProblem, problemResponse } from "./problem";

const maximumJsonBodyBytes = 32 * 1024;

export interface RequestContext<TBody = undefined> {
  request: Request;
  requestId: string;
  sessionHash: string | undefined;
  body: TBody;
}

interface HandlerOptions<TBody> {
  unsafe?: boolean;
  protected?: boolean;
  bodySchema?: ZodType<TBody>;
  cacheControl?: string;
}

function applyHeaders(response: Response, requestId: string, cacheControl: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", requestId);
  headers.set("Cache-Control", cacheControl);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function parseBody<TBody>(request: Request, schema: ZodType<TBody>): Promise<TBody> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppProblem(415, problemTypes.unsupportedContentType, "JSON erforderlich");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maximumJsonBodyBytes)
    throw new AppProblem(413, problemTypes.requestTooLarge, "Anfrage zu groß");
  const bytes = await request.arrayBuffer();

  if (bytes.byteLength > maximumJsonBodyBytes)
    throw new AppProblem(413, problemTypes.requestTooLarge, "Anfrage zu groß");
  let value: unknown;

  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppProblem(
      400,
      problemTypes.unreadableRequest,
      "Anfrage konnte nicht gelesen werden",
    );
  }

  const result = schema.safeParse(value);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      pointer: `/${issue.path.join("/")}`,
      code: issue.code,
    }));

    throw new AppProblem(422, problemTypes.invalidRequest, "Eingaben prüfen", undefined, errors);
  }

  return result.data;
}

export async function handleRequest<TBody = undefined>(
  request: Request,
  options: HandlerOptions<TBody>,
  handler: (context: RequestContext<TBody>) => Promise<Response>,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let status = 500;
  let errorCategory = "unexpected";

  try {
    if (options.unsafe && !isAllowedUnsafeRequest(request)) {
      throw new AppProblem(403, problemTypes.invalidOrigin, "Anfrage nicht erlaubt");
    }

    const sessionHash = options.protected ? await getAuthenticatedSessionHash(request) : undefined;

    if (options.protected && !sessionHash)
      throw new AppProblem(401, problemTypes.unauthenticated, "Anmeldung erforderlich");

    const body = options.bodySchema
      ? await parseBody(request, options.bodySchema)
      : (undefined as TBody);
    const response = await handler({ request, requestId, sessionHash, body });

    status = response.status;
    errorCategory = "none";

    return applyHeaders(response, requestId, options.cacheControl ?? "no-store");
  } catch (error) {
    const problem =
      error instanceof AppProblem
        ? error
        : new AppProblem(500, problemTypes.unexpected, "Da ist etwas schiefgegangen");

    status = problem.status;
    errorCategory = problem.type;

    const response = problemResponse(problem, requestId);

    if (problem.status === 429 && problem.retryAfter !== undefined)
      response.headers.set("Retry-After", String(Math.max(1, Math.ceil(problem.retryAfter))));

    return applyHeaders(response, requestId, "no-store");
  } finally {
    console.info(
      JSON.stringify({
        requestId,
        route: new URL(request.url).pathname,
        status,
        durationMs: Math.round(performance.now() - startedAt),
        errorCategory,
      }),
    );
  }
}
