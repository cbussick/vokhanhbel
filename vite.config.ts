import { readFileSync } from "node:fs";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { z } from "zod";

const deploymentSchema = z.object({
  headers: z.array(z.object({ source: z.string(), headers: z.array(z.object({ key: z.string(), value: z.string() })) })),
});
const deployment = deploymentSchema.parse(JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")));

/**
 * The preview server backs the end-to-end suite, so it has to answer with the same headers
 * production sends. Reading them from vercel.json keeps one source of truth.
 */
const previewHeaders = Object.fromEntries(
  deployment.headers
    .filter((entry) => entry.source === "/(.*)")
    .flatMap((entry) => entry.headers.map(({ key, value }) => [key, value])),
);

export default defineConfig({
  preview: { headers: previewHeaders },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: String.raw`\.test\.`,
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Comfortably above the five-second async timeout in src/test/setup.ts, so a genuinely stuck
    // query reports itself rather than being cut off by the surrounding test.
    testTimeout: 15_000,
    // Docker worktree isolation runs with its dedicated Node config, not this jsdom unit budget.
    exclude: [
      ...configDefaults.exclude,
      "tests/database/**",
      "tests/e2e/**",
      "scripts/localDevelopment.integration.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
