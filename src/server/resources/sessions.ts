import { createHmac } from "node:crypto";
import { z } from "zod";
import { problemTypes } from "../../contracts/problem.js";
import type { loginInputSchema } from "../../contracts/session.js";
import { verifyPassword } from "../auth/password.js";
import { createSessionIdentifier, hashSessionIdentifier } from "../auth/sessionIdentifier.js";
import { getServerEnvironment } from "../config/environment.js";
import { getPool } from "../database/client.js";
import { AppProblem } from "../http/problem.js";

type LoginInput = z.infer<typeof loginInputSchema>;
const loginWindowMilliseconds = 15 * 60 * 1_000;
const loginAttemptLimit = 10;
const sessionDurationMilliseconds = 30 * 24 * 60 * 60 * 1_000;
const loginAttemptSummarySchema = z.object({
  value: z.string().regex(/^\d+$/u),
  oldest: z.date().nullable(),
});

function getIpPseudonym(request: Request): string {
  const rawIp =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  return createHmac("sha256", getServerEnvironment().RATE_LIMIT_HMAC_SECRET)
    .update(rawIp)
    .digest("base64url");
}

export async function login(request: Request, input: LoginInput): Promise<string> {
  const ipHash = getIpPseudonym(request);
  const now = new Date();
  const windowStart = new Date(now.getTime() - loginWindowMilliseconds);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ipHash]);
    await client.query("DELETE FROM login_attempts WHERE attempted_at < $1", [windowStart]);
    const result = await client.query(
      `SELECT COUNT(*) AS value, MIN(attempted_at) AS oldest
       FROM login_attempts WHERE ip_hash=$1 AND attempted_at >= $2`,
      [ipHash, windowStart],
    );
    const summary = loginAttemptSummarySchema.parse(result.rows[0]);
    const count = Number(summary.value);

    if (count >= loginAttemptLimit) {
      const oldest = summary.oldest;
      const retryAfter = oldest
        ? Math.max(
            1,
            Math.ceil((oldest.getTime() + loginWindowMilliseconds - now.getTime()) / 1_000),
          )
        : Math.ceil(loginWindowMilliseconds / 1_000);

      throw new AppProblem(
        429,
        problemTypes.loginRateLimit,
        "Zu viele Versuche",
        undefined,
        undefined,
        retryAfter,
      );
    }
    if (!(await verifyPassword(input.password, getServerEnvironment().APP_PASSWORD_HASH))) {
      await client.query("INSERT INTO login_attempts (ip_hash) VALUES ($1)", [ipHash]);
      await client.query("COMMIT");
      throw new AppProblem(401, problemTypes.wrongPassword, "Passwort stimmt nicht");
    }

    await client.query("DELETE FROM login_attempts WHERE ip_hash=$1", [ipHash]);

    const identifier = createSessionIdentifier();

    await client.query("INSERT INTO sessions (identifier_hash, expires_at) VALUES ($1, $2)", [
      hashSessionIdentifier(identifier),
      new Date(now.getTime() + sessionDurationMilliseconds),
    ]);
    await client.query("COMMIT");

    return identifier;
  } catch (error) {
    if (!(error instanceof AppProblem && error.type === problemTypes.wrongPassword)) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }
}
