import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { openStory } from "./openStory.js";

const index = z
  .object({
    entries: z.record(
      z.string(),
      z.object({ id: z.string(), type: z.string(), title: z.string(), name: z.string() }),
    ),
  })
  .parse(
    JSON.parse(readFileSync(new URL("../../storybook-static/index.json", import.meta.url), "utf8")),
  );

for (const story of Object.values(index.entries).filter((entry) => entry.type === "story")) {
  test(`${story.title} / ${story.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
        errors.push(message.text());
    });
    await openStory(page, story.id);
    await expect(page.locator(".sb-errordisplay")).not.toBeVisible();
    await expect(page.locator("#storybook-root")).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    expect(errors).toEqual([]);
  });
}

test("native Escape closes an idle dialog but not a busy one", async ({ page }) => {
  await page.goto("/iframe.html?id=components-dialog--open&viewMode=story");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/iframe.html?id=components-dialog--busy&viewMode=story");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("token page includes the live palette and derived hover surfaces", async ({ page }) => {
  await page.goto("/iframe.html?id=foundations-colors--palette&viewMode=story");
  await expect(page.getByRole("heading", { name: "--color-primary", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "--color-primary-hover", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
    ),
  ).toBe("#add8e6");
});
