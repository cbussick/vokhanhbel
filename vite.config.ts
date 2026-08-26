import { readFileSync } from "node:fs";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// SAFETY: vercel.json is committed to this repository, so its shape is controlled here rather than
// supplied externally. A mismatch fails the build loudly.
const deployment = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

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
    exclude: [...configDefaults.exclude, "tests/database/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
