import type { ZodType } from "zod";
import { apiPaths } from "../contracts/apiPaths";
import { problemSchema, problemTypes } from '../contracts/problem';
import type { Problem } from '../contracts/problem';
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

async function fetchApiResponse(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (init?.body) {headers.set("content-type", "application/json");}
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });

  if (response.status === 401 && path !== apiPaths.session) {publishSessionExpired();}
  if (!response.ok) {await throwApiError(response);}

  return response;
}

export async function apiRequest<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetchApiResponse(path, init);
  if (response.status === 204) {throw new Error("Expected a JSON response, received no content");}

  return schema.parse(await response.json());
}

export async function apiCommand(path: string, init?: RequestInit): Promise<void> {
  const response = await fetchApiResponse(path, init);
  // Some commands return JSON which callers intentionally do not consume (Review Submission).
  // Keep checking JSON syntax, without inventing an unchecked caller-chosen return type.
  if (response.status !== 204) {await response.json();}
}

export async function throwApiError(response: Response): Promise<never> {
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

export function isTemporaryError(error: unknown): boolean {
  return !navigator.onLine || !(error instanceof ApiError) || error.problem.status >= 500;
}
