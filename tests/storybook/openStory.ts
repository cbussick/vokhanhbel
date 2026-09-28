import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    /** Storybook 10's render lifecycle includes execution of the story's play function. */
    __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } };
  }
}

export async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  // Navigation finishing does not mean the async story loader and play function have finished.
  await expect
    // oxlint-disable-next-line no-underscore-dangle -- Storybook's pinned render lifecycle API
    .poll(() => page.evaluate(() => window.__STORYBOOK_PREVIEW__?.currentRender?.phase), {
      timeout: 20_000,
    })
    .toBe("finished");
}
