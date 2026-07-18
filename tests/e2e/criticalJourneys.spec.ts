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
    if (pathname.endsWith("/khunhphap-replies"))
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

test("completes Review, Khunhphap, repeat-ready summary, and Me", async ({ page }) => {
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
  await expect(page.getByRole("button", { name: "Khunhphap fragen" })).toBeVisible();
  await page.getByRole("button", { name: "Khunhphap fragen" }).click();
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

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 900 },
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
    await page.getByRole("button", { name: "Khunhphap fragen" }).click();
    await expect(page.getByRole("heading", { name: "Khunhphap" })).toBeVisible();
    await expect(page).toHaveScreenshot(`khunhphap-${viewport.name}.png`, {
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
