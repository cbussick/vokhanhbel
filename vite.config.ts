import { readFileSync } from "node:fs";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { localDevelopmentPlugin, type DevelopmentDeployment } from "./scripts/localApi.js";

// SAFETY: vercel.json is committed to this repository, so its shape is controlled here rather than
// supplied externally. A mismatch fails the build loudly.
const deployment = JSON.parse(
  readFileSync(new URL("./vercel.json", import.meta.url), "utf8"),
) as DevelopmentDeployment;

/**
 * The preview server backs the end-to-end suite, so it has to answer with the same headers
 * production sends. Reading them from vercel.json keeps one source of truth.
 */
const previewHeaders = Object.fromEntries(
  deployment.headers
    .filter((entry) => entry.source === "/(.*)")
    .flatMap((entry) => entry.headers.map(({ key, value }) => [key, value])),
);

export default defineConfig(({ mode }) => ({
  preview: { headers: previewHeaders },
  plugins: [
    // Vitest's jsdom runner uses client transforms for server-side test/setup modules. Real dev
    // servers (including --mode test outside Vitest) must always retain the browser boundary.
    ...(process.env.VITEST && mode === "test"
      ? []
      : [localDevelopmentPlugin(deployment, mode === "local-fullstack")]),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: "\\.test\\.",
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
      "scripts/*.integration.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
}));
