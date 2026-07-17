export function isAllowedUnsafeRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");

  if (!origin) return false;

  return origin === new URL(request.url).origin;
}
