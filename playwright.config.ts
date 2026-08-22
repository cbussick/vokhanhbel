import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const ciOutputDir = join(tmpdir(), "vokhanhbel-playwright-results");

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: process.env.CI ? ciOutputDir : "test-results",
  // Every test stubs the API with page.route, so no test shares state with another.
  fullyParallel: true,
  // Tuned by hand: WebKit starts timing out above this on a 12-core machine.
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // The built app, not the dev server: it serves a handful of bundles instead of every module
    // separately, which is what makes the suite fast enough to run in parallel. Reuse stays off so
    // a server left over from an earlier run can never serve stale code.
    command: "npm run serve:e2e",
    // The command builds first, which is slower on a cold CI runner than the 60s default allows.
    timeout: 180_000,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    // Without this the build and server output is swallowed, and a startup failure reports only
    // that the wait timed out.
    stdout: "pipe",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
