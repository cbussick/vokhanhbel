import { defineConfig } from "@playwright/test";
import config from "./playwright.config.js";

// The runner builds with the repository's Node version before entering the pinned browser OS.
export default defineConfig({
  ...config,
  workers: 1,
  outputDir: "test-results/container",
  webServer: {
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    command:
      'node --input-type=module -e \'import { preview } from "vite"; import { previewHeaders } from "./tools/previewHeaders.ts"; await preview({ configFile: false, preview: { headers: previewHeaders, host: "127.0.0.1", port: 4173, strictPort: true } });\' ',
  },
});
