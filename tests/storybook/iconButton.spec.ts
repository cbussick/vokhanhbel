import { expect, test, type Locator } from "@playwright/test";

async function iconAppearance(button: Locator) {
  return button.evaluate((element) => {
    const icon = element.firstElementChild!;
    const svg = icon.querySelector("svg")!;
    const label = element.lastElementChild!;
    const svgBox = svg.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();

    return {
      backgrounds: [icon, ...icon.querySelectorAll("span")].map(
        (node) => getComputedStyle(node).backgroundColor,
      ),
      width: svgBox.width,
      height: svgBox.height,
      verticalOffset:
        Math.round((svgBox.y + svgBox.height / 2 - labelBox.y - labelBox.height / 2) * 100) / 100,
      stroke: getComputedStyle(svg).stroke,
      textColor: getComputedStyle(label).color,
      path: svg.querySelector("path")!.getAttribute("d"),
    };
  });
}

for (const story of [
  "components-iconbutton--primary",
  "components-emptystate--with-action",
  "screens-app-shell--with-context-and-action",
]) {
  test(`${story} uses the same unframed action icon as the app`, async ({ page }) => {
    await page.goto("/iframe.html?id=screens-app-pages--empty-card-list&viewMode=story");
    const appButton = page.getByRole("button", { name: "Karte hinzufügen", exact: true });
    await expect(appButton).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    const app = await iconAppearance(appButton);
    expect(app.backgrounds).toEqual(["rgba(0, 0, 0, 0)"]);
    expect(app.verticalOffset).toBe(0);
    expect(app.stroke).toBe(app.textColor);

    await page.goto(`/iframe.html?id=${story}&viewMode=story`);
    const storyButton = page.getByRole("button", { name: "Karte hinzufügen", exact: true });
    await expect(storyButton).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    expect(await iconAppearance(storyButton)).toEqual(app);
  });
}
