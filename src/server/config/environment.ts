import { z } from "zod";

const serverEnvironmentSchema = z.object({
  APP_PASSWORD_HASH: z.string().min(1),
  DATABASE_URL: z.url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  RATE_LIMIT_HMAC_SECRET: z.string().min(32),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse(process.env);

  return cachedEnvironment;
}

export function resetServerEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
