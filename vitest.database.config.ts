import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/database/testDatabase.js";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/database/**/*.test.ts"],
    globalSetup: ["./tests/database/globalSetup.ts"],
    setupFiles: ["./tests/database/setup.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      APP_PASSWORD_HASH: "test-only-placeholder",
      OPENAI_API_KEY: "test-only-placeholder",
      OPENAI_MODEL: "test-model",
      RATE_LIMIT_HMAC_SECRET: "test-only-secret-at-least-thirty-two-characters",
      // Placeholders only. Every suite substitutes the speech provider, so no run reaches Google
      // and none needs a real service-account key.
      GOOGLE_TTS_PROJECT_ID: "test-only-placeholder",
      GOOGLE_TTS_CLIENT_EMAIL: "test-only-placeholder",
      GOOGLE_TTS_PRIVATE_KEY: "test-only-placeholder",
    },
  },
});
