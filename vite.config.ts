import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { previewHeaders } from "./tools/previewHeaders.js";

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
