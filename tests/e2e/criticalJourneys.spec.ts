import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

interface MockCard {
  id: string;
  front: string;
  back: string;
  box: number;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
}

const fixedNow = "2026-07-14T08:00:00.000Z";

function createCard(front = "der Apfel", back = "the apple"): MockCard {
  return {
    id: crypto.randomUUID(),
    front,
    back,
    box: 0,
    dueAt: "2026-07-13T22:00:00.000Z",
    lastReviewedAt: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    deletedAt: null,
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installMockApi(page: Page, authenticated = true) {
  const state = { authenticated, cards: [createCard()] };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/session" && request.method() === "GET")
      return json(route, { authenticated: state.authenticated });
    if (pathname === "/api/session" && request.method() === "POST") {
      state.authenticated = true;

      return route.fulfill({ status: 204 });
    }
    if (pathname === "/api/session" && request.method() === "DELETE") {
      state.authenticated = false;

      return route.fulfill({ status: 204 });
    }
    if (pathname === "/api/cards" && request.method() === "GET") return json(route, state.cards);
    if (pathname === "/api/cards" && request.method() === "POST") {
      const input = request.postDataJSON() as { front: string; back: string };
      const card = createCard(input.front, input.back);
      state.cards.unshift(card);

      return json(route, card, 201);
    }
    if (pathname === "/api/reviews" && request.method() === "POST") {
      const input = request.postDataJSON() as { id: string; cardId: string; grade: string };

      return json(route, {
        review: {
          id: input.id,
          cardId: input.cardId,
          grade: input.grade,
          pointsAwarded: 10,
          boxBefore: 0,
          boxAfter: 1,
          reviewedAt: fixedNow,
          recordedAt: fixedNow,
        },
        card: { ...state.cards[0], box: 1 },
      });
    }
    if (pathname === "/api/stats")
      return json(route, {
        totalPoints: 35,
        activeCardCount: state.cards.length,
        reviewsThisWeek: 4,
        bestDay: { date: "2026-07-14", reviewCount: 4 },
        dailyRecap: { period: "today", date: "2026-07-14", reviewCount: 4, knewItCount: 3 },
      });
    if (pathname.endsWith("/tutor-replies"))
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'event: delta\ndata: {"text":"Ein Apfel ist eine Frucht."}\n\nevent: done\ndata: {"truncated":false}\n\n',
      });

    return route.fulfill({ status: 404 });
  });

  return state;
}

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

test("logs in with the exact password and logs out", async ({ page }) => {
  await installMockApi(page, false);
  await page.goto("/login");
  await page.getByLabel("Passwort").fill("  exact household password  ");
  await page.getByRole("button", { name: "App öffnen" }).click();
  await expect(page.getByRole("heading", { name: "Wiederholen" })).toBeVisible();
  await page.getByRole("link", { name: /Ich/ }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByRole("heading", { name: "Willkommen zurück" })).toBeVisible();
});

test("login form remains usable at the narrowest supported width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installMockApi(page, false);
  await page.goto("/login");

  const password = page.getByLabel("Passwort");
  const submit = page.getByRole("button", { name: "App öffnen" });

  await password.fill("12345");

  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Das Passwort stimmt nicht. Versuch es noch einmal.",
  );
  await expect(password).toHaveValue("");
  expect(
    await page.evaluate<number>("document.documentElement.scrollWidth"),
    "login page must not overflow horizontally",
  ).toBeLessThanOrEqual(await page.evaluate<number>("document.documentElement.clientWidth"));

  await password.fill("123456");
  await submit.click();
  await expect(page.getByRole("heading", { name: "Wiederholen" })).toBeVisible();

  const reviewLinkBox = await page.getByRole("link", { name: /Wiederholen/ }).boundingBox();
  const cardsLinkBox = await page.getByRole("link", { name: /Karten/ }).boundingBox();
  const mainBox = await page.locator("main").boundingBox();

  expect(reviewLinkBox).not.toBeNull();
  expect(cardsLinkBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(Math.abs(reviewLinkBox!.y - cardsLinkBox!.y)).toBeLessThanOrEqual(1);
  expect(cardsLinkBox!.x).toBeGreaterThan(reviewLinkBox!.x);
  expect(mainBox!.width).toBeLessThanOrEqual(320);
});

test("creates, searches, and opens a Card accessibly", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/cards");
  await page.getByRole("button", { name: "Karte hinzufügen" }).first().click();
  await page.getByLabel("Vorderseite").fill("xin chào");
  await page.getByLabel("Rückseite").fill("hallo");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("xin chào")).toBeVisible();
  await page.getByLabel("Karten durchsuchen").fill("CHÀO");
  await expect(page.getByText("xin chào")).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("completes Review, Tutor, repeat-ready summary, and Me", async ({ page }) => {
  const preloadErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("_nonReactive"))
      preloadErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (error.message.includes("_nonReactive")) preloadErrors.push(error.message);
  });

  await installMockApi(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/review");
  await page.getByRole("button", { name: "Review starten" }).click();
  await page.getByRole("button", { name: "Antwort zeigen" }).click();
  await expect(page.getByRole("button", { name: "Tutopher fragen" })).toBeVisible();
  await page.getByRole("button", { name: "Tutopher fragen" }).click();
  await page.getByRole("button", { name: "Einfach erklären" }).click();
  await expect(page.getByText("Ein Apfel ist eine Frucht.")).toBeVisible();
  await page.getByRole("button", { name: "Schließen" }).click();
  await page.getByRole("button", { name: /Gewusst/ }).click();
  await expect(page.getByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
  await page.getByRole("button", { name: "Fertig" }).click();
  await page.getByRole("link", { name: /Ich/ }).click();
  await expect(page.getByRole("heading", { name: "Khanhs Fortschritt" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  expect(preloadErrors).toEqual([]);
});

test("does not make a short Card front scrollable", async ({ page }) => {
  const state = await installMockApi(page);
  state.cards[0] = createCard("Apfel", "the apple");

  await page.goto("/review");
  await page.getByRole("button", { name: "Review starten" }).click();

  const front = page.getByRole("region", { name: "Kartenvorderseite" });
  await expect(front).toBeVisible();
  expect(
    await page.evaluate<number>(`(() => {
      const element = document.querySelector('[aria-label="Kartenvorderseite"]');
      if (!element) throw new Error("Card front not found");
      const descendants = [element, ...element.querySelectorAll("*")];
      return descendants.filter(candidate => {
        const { overflowX, overflowY } = getComputedStyle(candidate);
        return [overflowX, overflowY].some(value => value === "auto" || value === "scroll");
      }).length;
    })()`),
    "a short Card front must not create any scroll containers",
  ).toBe(0);
});

test("aligns the Review close action with the progress header", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/review");
  await page.getByRole("button", { name: "Review starten" }).click();

  const progress = page.locator("#review-progress");
  const progressWrapBox = await progress.locator("..").boundingBox();
  const closeBox = await page.getByRole("button", { name: "Review beenden" }).boundingBox();

  expect(progressWrapBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(
    Math.abs(
      progressWrapBox!.y + progressWrapBox!.height / 2 - (closeBox!.y + closeBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(1);

  const restingProgress = await progress.screenshot();
  await progress.hover();
  expect(await progress.screenshot()).toEqual(restingProgress);
});

test("does not outline the main landmark after modifier-only keyboard input", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/review");
  await expect(page.getByRole("button", { name: "Review starten" })).toBeVisible();

  await page.locator("main").click({ position: { x: 12, y: 12 } });
  await page.keyboard.press("Shift");

  const mainFocus = await page.evaluate<{
    active: boolean;
    outlineStyle: string;
    outlineWidth: string;
  }>(`(() => {
    const element = document.querySelector("main");
    if (!element) throw new Error("Main landmark not found");
    const style = getComputedStyle(element);
    return {
      active: document.activeElement === element,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  })()`);

  expect(mainFocus.active).toBe(false);
  expect(mainFocus.outlineStyle === "none" || mainFocus.outlineWidth === "0px").toBe(true);

  await page.reload();
  await expect(page.getByRole("button", { name: "Review starten" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Zum Inhalt springen" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("adapts the app shell between tablet and desktop widths", async ({ page }) => {
  await installMockApi(page);

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/cards");

  const appName = page.getByText("Vokhanhbel", { exact: true });
  const reviewLink = page.getByRole("link", { name: /Wiederholen/ });
  const cardsLink = page.getByRole("link", { name: /Karten/ });
  const tabletReviewBox = await reviewLink.boundingBox();
  const tabletCardsBox = await cardsLink.boundingBox();
  const tabletMainBox = await page.locator("main").boundingBox();

  await expect(appName).toBeHidden();
  expect(tabletReviewBox).not.toBeNull();
  expect(tabletCardsBox).not.toBeNull();
  expect(tabletMainBox).not.toBeNull();
  expect(Math.abs(tabletReviewBox!.y - tabletCardsBox!.y)).toBeLessThanOrEqual(1);
  expect(tabletCardsBox!.x).toBeGreaterThan(tabletReviewBox!.x);
  expect(tabletMainBox!.width).toBeGreaterThan(480);

  await page.setViewportSize({ width: 900, height: 900 });
  const mediumNavBox = await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .boundingBox();
  const mediumMainBox = await page.locator("main").boundingBox();

  expect(mediumNavBox).not.toBeNull();
  expect(mediumMainBox).not.toBeNull();
  expect(mediumNavBox!.x).toBe(0);
  expect(mediumNavBox!.width).toBe(900);
  expect(mediumMainBox!.width).toBeLessThanOrEqual(768);

  await page.setViewportSize({ width: 1024, height: 900 });
  const desktopReviewBox = await reviewLink.boundingBox();
  const desktopCardsBox = await cardsLink.boundingBox();
  const desktopMainBox = await page.locator("main").boundingBox();

  await expect(appName).toBeVisible();
  expect(desktopReviewBox).not.toBeNull();
  expect(desktopCardsBox).not.toBeNull();
  expect(desktopMainBox).not.toBeNull();
  expect(Math.abs(desktopReviewBox!.x - desktopCardsBox!.x)).toBeLessThanOrEqual(1);
  expect(desktopCardsBox!.y).toBeGreaterThan(desktopReviewBox!.y);
  expect(desktopMainBox!.x).toBeGreaterThan(desktopCardsBox!.x + desktopCardsBox!.width);
});

test("uses desktop space for route content without overstretching focused work", async ({
  page,
}) => {
  const state = await installMockApi(page);
  state.cards.push(createCard("die Birne", "the pear"), createCard("die Pflaume", "the plum"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/cards");

  const cardItems = page.getByRole("listitem");
  const firstCardBox = await cardItems.nth(0).boundingBox();
  const secondCardBox = await cardItems.nth(1).boundingBox();

  expect(firstCardBox).not.toBeNull();
  expect(secondCardBox).not.toBeNull();
  expect(Math.abs(firstCardBox!.y - secondCardBox!.y)).toBeLessThanOrEqual(1);
  expect(secondCardBox!.x).toBeGreaterThan(firstCardBox!.x);

  await page.getByRole("button", { name: "Karte hinzufügen" }).click();
  const editorBox = await page.getByRole("dialog").boundingBox();

  expect(editorBox).not.toBeNull();
  expect(editorBox!.width).toBeGreaterThan(560);
  expect(editorBox!.width).toBeLessThanOrEqual(640);
  await page.getByRole("button", { name: "Schließen" }).click();

  await page.getByRole("link", { name: /Ich/ }).click();
  const pointsBox = await page.getByText("Punkte insgesamt").locator("..").boundingBox();
  const activeCardsBox = await page.getByText("Aktive Karten").locator("..").boundingBox();
  const weeklyReviewsBox = await page.getByText("Reviews diese Woche").locator("..").boundingBox();
  const bestDayBox = await page.getByText("Bester Tag").locator("..").boundingBox();

  expect(pointsBox).not.toBeNull();
  expect(activeCardsBox).not.toBeNull();
  expect(weeklyReviewsBox).not.toBeNull();
  expect(bestDayBox).not.toBeNull();
  expect(pointsBox!.width).toBeGreaterThan(activeCardsBox!.width * 2);
  expect(activeCardsBox!.y).toBeGreaterThan(pointsBox!.y);
  expect(Math.abs(activeCardsBox!.y - weeklyReviewsBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(weeklyReviewsBox!.y - bestDayBox!.y)).toBeLessThanOrEqual(1);

  await page.getByRole("link", { name: /Wiederholen/ }).click();
  await page.getByRole("button", { name: "Review starten" }).click();
  const focusedMainBox = await page.locator("main").boundingBox();

  expect(focusedMainBox).not.toBeNull();
  expect(focusedMainBox!.width).toBeGreaterThan(700);
  expect(focusedMainBox!.width).toBeLessThanOrEqual(768);
  expect(Math.abs(focusedMainBox!.x - (1440 - focusedMainBox!.width) / 2)).toBeLessThanOrEqual(1);
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1440, height: 1000 },
] as const) {
  test(`stable visual states at ${viewport.name} width`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "One browser owns the cross-platform visual baselines.");
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installMockApi(page, false);
    await page.goto("/login");
    await expect(page.getByLabel("Passwort")).toBeVisible();
    await expect(page).toHaveScreenshot(`login-${viewport.name}.png`, { animations: "disabled" });

    await page.getByLabel("Passwort").fill("exact household password");
    await page.getByRole("button", { name: "App öffnen" }).click();
    await page.getByRole("button", { name: "Review starten" }).click();
    await expect(page.getByRole("button", { name: "Antwort zeigen" })).toBeVisible();
    await expect(page).toHaveScreenshot(`review-front-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Antwort zeigen" }).click();
    await expect(page.getByRole("button", { name: /Gewusst/ })).toBeVisible();
    await expect(page).toHaveScreenshot(`review-back-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Tutopher fragen" }).click();
    await expect(page.getByRole("heading", { name: "Tutopher" })).toBeVisible();
    await expect(page).toHaveScreenshot(`tutor-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Schließen" }).click();
    await page.getByRole("button", { name: /Gewusst/ }).click();
    await expect(page.getByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    await expect(page).toHaveScreenshot(`review-summary-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Fertig" }).click();
    await page.getByRole("link", { name: /Karten/ }).click();
    await expect(page.getByRole("heading", { name: "Karten" })).toBeVisible();
    await expect(page).toHaveScreenshot(`cards-${viewport.name}.png`, { animations: "disabled" });
    await page.getByRole("button", { name: "Karte hinzufügen" }).first().click();
    await expect(page.getByRole("heading", { name: "Karte erstellen" })).toBeVisible();
    await expect(page).toHaveScreenshot(`card-editor-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Schließen" }).click();
    await page.getByRole("link", { name: /Ich/ }).click();
    await expect(page.getByRole("heading", { name: "Khanhs Fortschritt" })).toBeVisible();
    await expect(page).toHaveScreenshot(`me-${viewport.name}.png`, { animations: "disabled" });
  });
}
