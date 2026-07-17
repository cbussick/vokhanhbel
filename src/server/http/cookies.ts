export const sessionCookieName = "__Host-session";

export function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(";")) {
    const [key, ...valueParts] = item.trim().split("=");

    if (key === name) return decodeURIComponent(valueParts.join("="));
  }

  return undefined;
}

export function createSessionCookie(identifier: string): string {
  return `${sessionCookieName}=${encodeURIComponent(identifier)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
