export class AppProblem extends Error {
  constructor(
    public readonly status: number,
    public readonly type: string,
    public readonly title: string,
    public readonly detail?: string,
    public readonly errors?: { pointer: string; code: string }[],
    public readonly retryAfter?: number,
  ) {
    super(title);
  }
}

export function problemResponse(problem: AppProblem, requestId: string): Response {
  const body: Record<string, unknown> = {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    instance: `urn:uuid:${requestId}`,
  };

  if (problem.detail) body.detail = problem.detail;
  if (problem.errors) body.errors = problem.errors;

  return Response.json(body, {
    status: problem.status,
    headers: { "content-type": "application/problem+json" },
  });
}
