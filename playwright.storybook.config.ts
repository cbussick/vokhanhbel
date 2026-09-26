import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/storybook",
  fullyParallel: true,
  workers: 4,
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:6007",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        contextOptions: { reducedMotion: "reduce" },
      },
    },
  ],
  webServer: {
    command:
      "npx vite preview --config .storybook/vite.config.ts --outDir storybook-static --host 127.0.0.1 --port 6007 --strictPort",
    url: "http://127.0.0.1:6007",
    reuseExistingServer: !process.env.CI,
  },
});
