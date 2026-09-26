import { expect, test } from "@playwright/test";

for (const component of ["cardformdialog", "collectionformdialog", "topicformdialog"]) {
  test(`${component}: saving is blocked and failure is visible`, async ({ page }) => {
    await page.goto(`/iframe.html?id=components-${component}--saving&viewMode=story`);
    await expect(page.getByRole("button", { name: "Wird gespeichert …" })).toBeDisabled();
    await page.goto(`/iframe.html?id=components-${component}--save-failed&viewMode=story`);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Speichern", exact: true })).toBeEnabled();
  });
}

test("pronunciation states are produced by mocked requests", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=components-audio-pronunciationgenerator--generating&viewMode=story",
  );
  await expect(page.getByRole("button", { name: "Wird erzeugt …" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page.goto("/iframe.html?id=components-audio-pronunciationgenerator--failed&viewMode=story");
  await expect(page.getByRole("alert")).toContainText("Die Aussprache konnte nicht erzeugt werden");
});

test("Tutor replies use the local stream fixture", async ({ page }) => {
  await page.goto("/iframe.html?id=components-tutordialog--empty&viewMode=story");
  await page.getByRole("textbox", { name: "Deine Nachricht" }).fill("Was bedeutet xin chào?");
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(
    page.getByText("Xin chào ist eine freundliche Begrüßung.", { exact: true }),
  ).toBeVisible();
});

test("color exceptions include UI literals and original artwork sources", async ({ page }) => {
  await page.goto("/iframe.html?id=foundations-colors--local-colors-and-artwork&viewMode=story");
  await expect(page.getByRole("heading", { name: "#e7edf1", exact: true })).toBeVisible();
  await expect(
    page.getByText("src/components/TutopherAvatar.tsx", { exact: true }).first(),
  ).toBeVisible();
});
