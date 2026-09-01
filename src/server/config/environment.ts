import { z } from "zod";

const serverEnvironmentSchema = z.object({
  APP_PASSWORD_HASH: z.string().min(1),
  DATABASE_URL: z.url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  RATE_LIMIT_HMAC_SECRET: z.string().min(32),
  R2_ENVIRONMENT: z.enum(["preview", "production"]).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  GOOGLE_TTS_PROJECT_ID: z.string().min(1).optional(),
  GOOGLE_TTS_CLIENT_EMAIL: z.string().min(1).optional(),
  GOOGLE_TTS_PRIVATE_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(32).optional(),
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

export interface R2Environment {
  environment: "preview" | "production";
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getR2Environment(): R2Environment {
  const environment = getServerEnvironment();
  const required = [
    environment.R2_ENVIRONMENT,
    environment.R2_ACCOUNT_ID,
    environment.R2_BUCKET,
    environment.R2_ACCESS_KEY_ID,
    environment.R2_SECRET_ACCESS_KEY,
  ];

  if (required.some((value) => !value)) throw new Error("R2 configuration is incomplete");

  return {
    environment: environment.R2_ENVIRONMENT!,
    endpoint: `https://${environment.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    bucket: environment.R2_BUCKET!,
    accessKeyId: environment.R2_ACCESS_KEY_ID!,
    secretAccessKey: environment.R2_SECRET_ACCESS_KEY!,
  };
}

/** The service-account key the Text-to-Speech provider signs its calls with. */
export interface GoogleSpeechEnvironment {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function getGoogleSpeechEnvironment(): GoogleSpeechEnvironment {
  const environment = getServerEnvironment();
  const required = [
    environment.GOOGLE_TTS_PROJECT_ID,
    environment.GOOGLE_TTS_CLIENT_EMAIL,
    environment.GOOGLE_TTS_PRIVATE_KEY,
  ];

  if (required.some((value) => !value))
    throw new Error("Google Text-to-Speech configuration is incomplete");

  return {
    projectId: environment.GOOGLE_TTS_PROJECT_ID!,
    clientEmail: environment.GOOGLE_TTS_CLIENT_EMAIL!,
    // A deployment stores the key on one line, so its PEM line breaks arrive escaped.
    privateKey: environment.GOOGLE_TTS_PRIVATE_KEY!.replaceAll(String.raw`\n`, "\n"),
  };
}
