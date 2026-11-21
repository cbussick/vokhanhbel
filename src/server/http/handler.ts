import type { ZodType } from "zod";
import { problemTypes } from "../../contracts/problem.js";
import { getAuthenticatedSessionHash } from "../auth/session.js";
import { isAllowedPrivateMediaRequest, isAllowedUnsafeRequest } from "./origin.js";
import { AppProblemError, problemResponse } from "./problem.js";

const maximumJsonBodyBytes = 32 * 1024;

export interface RequestContext<TBody = undefined> {
  request: Request;
  requestId: string;
  sessionHash: string | undefined;
  body: TBody;
}

interface HandlerOptions {
  unsafe?: boolean;
  protected?: boolean;
  cacheControl?: string;
  privateMedia?: boolean;
}

function applyHeaders(response: Response, requestId: string, cacheControl: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", requestId);
  headers.set("Cache-Control", cacheControl);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function parseBody<TBody>(request: Request, schema: ZodType<TBody>): Promise<TBody> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppProblemError(415, problemTypes.unsupportedContentType, "JSON erforderlich");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maximumJsonBodyBytes) {
    throw new AppProblemError(413, problemTypes.requestTooLarge, "Anfrage zu groß");
  }
  const bytes = await request.arrayBuffer();

  if (bytes.byteLength > maximumJsonBodyBytes) {
    throw new AppProblemError(413, problemTypes.requestTooLarge, "Anfrage zu groß");
  }
  let value: unknown;

  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppProblemError(
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

    throw new AppProblemError(
      422,
      problemTypes.invalidRequest,
      "Eingaben prüfen",
      undefined,
      errors,
    );
  }

  return result.data;
}

async function runRequest(
  request: Request,
  options: HandlerOptions,
  handler: (context: Omit<RequestContext, "body">) => Promise<Response>,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let status = 500;
  let errorCategory = "unexpected";

  try {
    if (options.unsafe && !isAllowedUnsafeRequest(request)) {
      throw new AppProblemError(403, problemTypes.invalidOrigin, "Anfrage nicht erlaubt");
    }
    if (options.privateMedia && !isAllowedPrivateMediaRequest(request)) {
      throw new AppProblemError(403, problemTypes.invalidOrigin, "Anfrage nicht erlaubt");
    }

    const sessionHash = options.protected ? await getAuthenticatedSessionHash(request) : undefined;

    if (options.protected && !sessionHash) {
      throw new AppProblemError(401, problemTypes.unauthenticated, "Anmeldung erforderlich");
    }

    const response = await handler({ request, requestId, sessionHash });

    status = response.status;
    errorCategory = "none";

    return applyHeaders(response, requestId, options.cacheControl ?? "no-store");
  } catch (error) {
    const problem =
      error instanceof AppProblemError
        ? error
        : new AppProblemError(500, problemTypes.unexpected, "Da ist etwas schiefgegangen");

    status = problem.status;
    errorCategory = problem.type;

    const response = problemResponse(problem, requestId);

    if (problem.status === 429 && problem.retryAfter !== undefined) {
      response.headers.set("Retry-After", String(Math.max(1, Math.ceil(problem.retryAfter))));
    }

    return applyHeaders(response, requestId, "no-store");
  } finally {
    // eslint-disable-next-line no-console -- Native server request-log boundary preserves correlation IDs, severity, and structured platform diagnostics.
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

export function handleRequest(
  request: Request,
  options: HandlerOptions,
  handler: (context: RequestContext) => Promise<Response>,
): Promise<Response> {
  return runRequest(request, options, (context) => handler({ ...context, body: undefined }));
}

export function handleJsonRequest<TBody>(
  request: Request,
  options: HandlerOptions & { bodySchema: ZodType<TBody> },
  handler: (context: RequestContext<TBody>) => Promise<Response>,
): Promise<Response> {
  return runRequest(request, options, async (context) =>
    handler({ ...context, body: await parseBody(request, options.bodySchema) }),
  );
}

type AuthenticatedContext<TBody = undefined> = RequestContext<TBody> & { sessionHash: string };

function authenticatedContext<TBody>(context: RequestContext<TBody>): AuthenticatedContext<TBody> {
  if (!context.sessionHash) {
    throw new AppProblemError(401, problemTypes.unauthenticated, "Anmeldung erforderlich");
  }

  return { ...context, sessionHash: context.sessionHash };
}

export function handleAuthenticatedRequest(
  request: Request,
  options: HandlerOptions,
  handler: (context: AuthenticatedContext) => Promise<Response>,
): Promise<Response> {
  return handleRequest(request, { ...options, protected: true }, (context) =>
    handler(authenticatedContext(context)),
  );
}

export function handleAuthenticatedJsonRequest<TBody>(
  request: Request,
  options: HandlerOptions & { bodySchema: ZodType<TBody> },
  handler: (context: AuthenticatedContext<TBody>) => Promise<Response>,
): Promise<Response> {
  return handleJsonRequest(request, { ...options, protected: true }, (context) =>
    handler(authenticatedContext(context)),
  );
}
