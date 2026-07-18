import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "../database/client.js";
import { sessions } from "../database/schema.js";
import { readCookie, sessionCookieName } from "../http/cookies.js";
import { hashSessionIdentifier } from "./sessionIdentifier.js";

const authenticatedSessionSchema = z.object({ identifierHash: z.string().min(1) });

export async function getAuthenticatedSessionHash(request: Request): Promise<string | undefined> {
  const identifier = readCookie(request, sessionCookieName);

  if (!identifier) return undefined;

  const identifierHash = hashSessionIdentifier(identifier);
  const now = new Date();
  const database = getDatabase();

  await database.delete(sessions).where(lt(sessions.expiresAt, now));
  const rows = await database
    .select({ identifierHash: sessions.identifierHash })
    .from(sessions)
    .where(and(eq(sessions.identifierHash, identifierHash), gt(sessions.expiresAt, now)))
    .limit(1);

  return rows[0] ? authenticatedSessionSchema.parse(rows[0]).identifierHash : undefined;
}

export async function revokeCurrentSession(request: Request): Promise<void> {
  const identifier = readCookie(request, sessionCookieName);

  if (!identifier) return;

  await getDatabase()
    .delete(sessions)
    .where(eq(sessions.identifierHash, hashSessionIdentifier(identifier)));
}
