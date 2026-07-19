import { apiPaths } from "../contracts/apiPaths";
import { problemSchema, problemTypes, type Problem } from "../contracts/problem";
import { publishSessionExpired } from "./sessionEvents";

export class ApiError extends Error {
  constructor(
    public readonly problem: Problem,
    public readonly retryAfter: number | undefined,
    public readonly requestId: string | undefined,
  ) {
    super(problem.title);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });

  if (response.status === 401 && path !== apiPaths.session) publishSessionExpired();
  if (!response.ok) {
    const parsed = problemSchema.safeParse(await response.json().catch(() => undefined));
    const problem = parsed.success
      ? parsed.data
      : {
          type: problemTypes.unexpected,
          title: "Da ist etwas schiefgegangen",
          status: response.status,
          instance: `urn:uuid:${crypto.randomUUID()}`,
        };
    const retryHeader = response.headers.get("retry-after");
    const requestId =
      response.headers.get("x-request-id") ??
      (parsed.success ? parsed.data.instance.replace(/^urn:uuid:/u, "") : undefined);

    throw new ApiError(problem, retryHeader ? Number(retryHeader) : undefined, requestId);
  }
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export function isTemporaryError(error: unknown): boolean {
  return !navigator.onLine || !(error instanceof ApiError) || error.problem.status >= 500;
}
