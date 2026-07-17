import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/database/**/*.test.ts"],
    setupFiles: ["./tests/database/setup.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/vokhanhbel_test",
      APP_PASSWORD_HASH: "test-only-placeholder",
      OPENAI_API_KEY: "test-only-placeholder",
      OPENAI_MODEL: "test-model",
      RATE_LIMIT_HMAC_SECRET: "test-only-secret-at-least-thirty-two-characters",
    },
  },
});
