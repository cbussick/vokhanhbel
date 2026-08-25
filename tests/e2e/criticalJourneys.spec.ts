import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

interface MockCard {
  id: string;
  collectionId: string;
  front: string | MockFace;
  back: string | MockFace;
  box: number;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
}

interface MockFace {
  text: string | null;
  audio: {
    id: string;
    durationMs: number;
    contentType: "audio/wav";
    byteSize: number;
  } | null;
}

const fixedNow = "2026-07-14T08:00:00.000Z";
const mockCollection = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Vietnamesisch",
  icon: "flag-vn",
  createdAt: fixedNow,
  updatedAt: fixedNow,
  deletedAt: null,
};

function createCard(
  front: MockCard["front"] = "der Apfel",
  back: MockCard["back"] = "the apple",
): MockCard {
  return {
    id: crypto.randomUUID(),
    collectionId: mockCollection.id,
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

function audio(id: string) {
  return { id, durationMs: 1_000, contentType: "audio/wav" as const, byteSize: 8_044 };
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
    if (pathname === "/api/collections" && request.method() === "GET")
      return json(route, [mockCollection]);
    if (pathname === "/api/topics" && request.method() === "GET") return json(route, []);
    if (pathname === "/api/cards" && request.method() === "GET") return json(route, state.cards);
    if (pathname === "/api/cards" && request.method() === "POST") {
      const input = request.postDataJSON() as {
        front: { text: string | null; audioId: string | null };
        back: { text: string | null; audioId: string | null };
      };
      const card = createCard(
        { text: input.front.text, audio: null },
        { text: input.back.text, audio: null },
      );
      state.cards.unshift(card);

      return json(route, card, 201);
    }
    if (pathname.startsWith("/api/audio/") && request.method() === "GET")
      return route.fulfill({ status: 200, contentType: "audio/wav", body: "mock audio" });
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

async function expectMobileFullscreenDialog(dialog: Locator, width: number, height: number) {
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();

      return (
        box && {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }
      );
    })
    .toEqual({ x: 0, y: 0, width, height });
  await expect(dialog.getByRole("button", { name: "Zurück" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Schließen" })).toBeHidden();
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
  await page.getByRole("link", { name: /Vietnamesisch/ }).click();
  await page.getByRole("button", { name: "Karte hinzufügen" }).first().click();
  await expect(page.getByRole("dialog", { name: "Karte erstellen" })).toHaveCSS("opacity", "1");
  await expect(page.getByText("Text", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Audio", { exact: true })).toHaveCount(2);
  await expectNoSeriousAxeViolations(page);
  const frontText = page.getByRole("textbox", {
    name: "Vorderseite Maximal 1.000 Zeichen",
  });
  await frontText.focus();
  const focusStyles = await page.evaluate<{
    textareaOutline: string;
    faceControlShadow: string;
  }>(`(() => {
    const textarea = document.querySelector("#card-front");
    const faceControl = textarea?.closest("fieldset")?.querySelector(":scope > div");
    if (!textarea || !faceControl) throw new Error("Card face control not found");
    return {
      textareaOutline: getComputedStyle(textarea).outlineStyle,
      faceControlShadow: getComputedStyle(faceControl).boxShadow,
    };
  })()`);
  expect(focusStyles.textareaOutline).toBe("none");
  expect(focusStyles.faceControlShadow).not.toBe("none");
  const collection = page.getByRole("combobox", { name: "Sammlung" });
  await collection.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await collection.press("Escape");
  await page.getByRole("textbox", { name: "Vorderseite Maximal 1.000 Zeichen" }).fill("xin chào");
  await page.getByRole("textbox", { name: "Rückseite Maximal 1.000 Zeichen" }).fill("hallo");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("xin chào")).toBeVisible();
  await page.getByLabel("Karten durchsuchen").fill("CHÀO");
  await expect(page.getByText("xin chào")).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("gives primary, surface, and navigation controls a hover state", async ({ page }) => {
  await installMockApi(page);
  await page.goto(`/cards/${mockCollection.id}`);

  const background = (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((element) => {
      const browser = globalThis as unknown as {
        getComputedStyle: (target: unknown) => { backgroundColor: string };
      };

      return browser.getComputedStyle(element).backgroundColor;
    });

  const addCard = page.getByRole("button", { name: "Karte hinzufügen" }).first();
  const cardRow = page.getByRole("listitem").filter({ hasText: "der Apfel" });
  const navLink = page.getByRole("link", { name: /Ich/ });

  for (const control of [addCard, cardRow, navLink]) {
    const idle = await background(control);
    await control.hover();
    expect(
      await background(control),
      `${await control.textContent()} must react to hover`,
    ).not.toBe(idle);
    await page.mouse.move(0, 0);
  }

  await addCard.click();
  const cancel = page.getByRole("button", { name: "Abbrechen" });
  const idleCancel = await background(cancel);

  await cancel.hover();
  expect(await background(cancel)).not.toBe(idleCancel);
});

test("keeps the Card dialog locked while Save is pending", async ({ page }) => {
  let saveRequests = 0;
  let releaseSave: () => void = () => undefined;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await installMockApi(page);
  await page.route("**/api/cards", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    saveRequests += 1;

    const input = route.request().postDataJSON() as {
      front: { text: string | null };
      back: { text: string | null };
    };
    await saveGate;
    await json(
      route,
      createCard({ text: input.front.text, audio: null }, { text: input.back.text, audio: null }),
      201,
    );
  });
  await page.goto(`/cards/${mockCollection.id}`);
  await page.getByRole("button", { name: "Karte hinzufügen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Vorderseite Maximal 1.000 Zeichen" }).fill("xin chào");
  await dialog.getByRole("textbox", { name: "Rückseite Maximal 1.000 Zeichen" }).fill("hallo");
  await dialog.getByRole("button", { name: "Speichern" }).click();

  const pendingSave = dialog.getByRole("button", { name: "Wird gespeichert …" });
  await expect(pendingSave).toHaveAttribute("aria-disabled", "true");
  await expect(pendingSave.locator('[aria-hidden="true"]')).toBeVisible();
  await expect(dialog.locator("section")).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByRole("button", { name: "Schließen" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
  const recordButtons = dialog.getByRole("button", { name: "Audio aufnehmen" });
  await expect(recordButtons).toHaveCount(2);
  await expect(recordButtons.nth(0)).toBeDisabled();
  await expect(recordButtons.nth(1)).toBeDisabled();
  await expect(dialog.getByRole("combobox", { name: "Sammlung" })).toBeDisabled();
  await expectNoSeriousAxeViolations(page);

  const pendingSaveBox = await pendingSave.boundingBox();
  expect(pendingSaveBox).not.toBeNull();
  await page.mouse.move(
    pendingSaveBox!.x + pendingSaveBox!.width / 2,
    pendingSaveBox!.y + pendingSaveBox!.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(200);
  await expect(pendingSave).toHaveCSS("translate", "none");
  await expect(pendingSave).toHaveCSS("filter", "none");
  await page.mouse.up();

  await pendingSave.dispatchEvent("click");
  expect(saveRequests).toBe(1);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  releaseSave();
  await expect(dialog).toBeHidden();
});

test("keeps the Card audio rail stable while dragging and recording", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }),
      },
    });
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: class {
        static isTypeSupported() {
          return true;
        }

        mimeType: string;
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;

        constructor(_stream: unknown, options?: { mimeType?: string }) {
          this.mimeType = options?.mimeType ?? "audio/webm;codecs=opus";
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["recording"], { type: this.mimeType }) });
          this.onstop?.();
        }
      },
    });
  });
  await installMockApi(page);
  await page.goto(`/cards/${mockCollection.id}`);
  await page.getByRole("button", { name: "Karte hinzufügen" }).first().click();
  const rail = page.getByRole("group", { name: "Audio für Vorderseite" });
  const idleBox = await rail.boundingBox();
  const dataTransfer = await page.evaluateHandle(() => {
    const browser = globalThis as unknown as {
      DataTransfer: new () => { items: { add: (file: Blob) => void } };
      File: new (bits: string[], name: string, options: { type: string }) => Blob;
    };
    const transfer = new browser.DataTransfer();

    transfer.items.add(new browser.File(["audio"], "test.wav", { type: "audio/wav" }));

    return transfer;
  });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await rail.getByText("Audiodatei hier ablegen oder auswählen").click();
  await fileChooserPromise;

  await rail.dispatchEvent("dragenter", { dataTransfer });
  await expect(rail).toHaveAttribute("data-dragging", "true");
  const dropCopy = rail.getByText("Audiodatei hier ablegen oder auswählen");
  await expect(dropCopy).toBeVisible();
  const dropStyles = await dropCopy.evaluate((element) => {
    const dropZone = element.parentElement;
    if (!dropZone) throw new Error("Audio drop zone not found");
    const browser = globalThis as unknown as {
      getComputedStyle: (target: unknown) => { borderRadius: string; cursor: string };
    };
    const styles = browser.getComputedStyle(dropZone);

    return {
      borderRadius: styles.borderRadius,
      cursor: styles.cursor,
    };
  });
  expect(dropStyles.borderRadius).not.toBe("0px");
  expect(dropStyles.cursor).toBe("copy");
  await rail.dispatchEvent("dragleave", { dataTransfer });
  await dataTransfer.dispose();
  await expect(rail).not.toHaveAttribute("data-dragging");

  const recordButton = rail.getByRole("button", { name: "Audio aufnehmen" });
  const idleButtonStyles = await recordButton.evaluate((element) => {
    const browser = globalThis as unknown as {
      getComputedStyle: (target: unknown) => {
        fontSize: string;
        fontWeight: string;
        scale: string;
      };
    };
    const styles = browser.getComputedStyle(element);

    return { fontSize: styles.fontSize, fontWeight: styles.fontWeight, scale: styles.scale };
  });
  await recordButton.hover();
  await page.mouse.down();
  await page.waitForTimeout(150);
  const pressedButtonStyles = await recordButton.evaluate((element) => {
    const browser = globalThis as unknown as {
      getComputedStyle: (target: unknown) => {
        fontSize: string;
        fontWeight: string;
        scale: string;
        translate: string;
      };
    };
    const styles = browser.getComputedStyle(element);

    return {
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      scale: styles.scale,
      translate: styles.translate,
    };
  });
  expect(pressedButtonStyles).toMatchObject(idleButtonStyles);
  // Pressing darkens the control; it must not move or resize it. The filter is read with a
  // retrying assertion because the press transition may still be interpolating.
  expect(pressedButtonStyles.translate).toBe("none");
  await expect(recordButton).toHaveCSS("filter", "brightness(0.94)");
  await page.mouse.up();
  await expect(rail.getByRole("button", { name: "Aufnahme stoppen" })).toBeVisible();
  await expect(rail.getByText(/Aufnahme · \d\.\d s/)).toBeVisible();
  const recordingBox = await rail.boundingBox();

  expect(idleBox).not.toBeNull();
  expect(recordingBox).not.toBeNull();
  expect(Math.abs(recordingBox!.height - idleBox!.height)).toBeLessThanOrEqual(1);
});

test("scrolls the Card dialog body below a fixed top bar and locks the page behind", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await installMockApi(page);
  await page.goto(`/cards/${mockCollection.id}`);
  await page.getByRole("button", { name: "Karte hinzufügen" }).first().click();
  const textarea = page.getByRole("textbox", {
    name: "Vorderseite Maximal 1.000 Zeichen",
  });

  await textarea.evaluate((element) => {
    element.style.height = "80rem";
  });
  const scrollState = await page.evaluate<{
    rootOverflow: string;
    dialogOverflow: string;
    sheetOverflow: string;
    sheetHasOverflow: boolean;
    bodyOverflow: string;
    bodyHasOverflow: boolean;
    headerMoved: boolean;
    textareaResize: string;
  }>(`(() => {
    const dialog = document.querySelector("dialog");
    const sheet = dialog?.querySelector(":scope > section");
    const header = sheet?.querySelector(":scope > header");
    const body = sheet?.querySelector(":scope > div");
    const textarea = document.querySelector("#card-front");
    if (!dialog || !sheet || !header || !body || !textarea)
      throw new Error("Card dialog sheet not found");
    const headerTop = header.getBoundingClientRect().top;
    body.scrollTop = body.scrollHeight;
    return {
      rootOverflow: getComputedStyle(document.documentElement).overflowY,
      dialogOverflow: getComputedStyle(dialog).overflowY,
      sheetOverflow: getComputedStyle(sheet).overflowY,
      sheetHasOverflow: sheet.scrollHeight > sheet.clientHeight,
      bodyOverflow: getComputedStyle(body).overflowY,
      bodyHasOverflow: body.scrollHeight > body.clientHeight,
      headerMoved: Math.abs(header.getBoundingClientRect().top - headerTop) > 0.5,
      textareaResize: getComputedStyle(textarea).resize,
    };
  })()`);

  expect(scrollState.rootOverflow).toBe("hidden");
  expect(scrollState.dialogOverflow).toBe("visible");
  expect(scrollState.sheetOverflow).toBe("hidden");
  expect(scrollState.sheetHasOverflow).toBe(false);
  expect(scrollState.bodyOverflow).toBe("auto");
  expect(scrollState.bodyHasOverflow).toBe(true);
  expect(scrollState.headerMoved).toBe(false);
  expect(scrollState.textareaResize).toBe("none");
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
  await expect(page.getByRole("button", { name: "Mit Tutopher reden" })).toBeVisible();
  await page.getByRole("button", { name: "Mit Tutopher reden" }).click();
  await page.getByRole("button", { name: "Einfach erklären" }).click();
  await expect(
    page
      .getByRole("region", { name: "Unterhaltung mit Tutopher" })
      .getByText("Ein Apfel ist eine Frucht."),
  ).toBeVisible();
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
  // The root reserves a scrollbar gutter, so the layout width is narrower than the viewport.
  const mediumLayoutWidth = await page.evaluate<number>("document.body.clientWidth");

  expect(mediumNavBox).not.toBeNull();
  expect(mediumMainBox).not.toBeNull();
  expect(mediumNavBox!.x).toBe(0);
  expect(mediumNavBox!.width).toBe(mediumLayoutWidth);
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
  await page.goto(`/cards/${mockCollection.id}`);

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
  await expect(page.getByRole("button", { name: "Antwort zeigen" })).toBeVisible();

  const focusedMainBox = await page.locator("main").boundingBox();
  const layoutWidth = await page.evaluate<number>("document.body.clientWidth");

  expect(focusedMainBox).not.toBeNull();
  expect(focusedMainBox!.width).toBeGreaterThan(700);
  expect(focusedMainBox!.width).toBeLessThanOrEqual(768);
  expect(
    Math.abs(focusedMainBox!.x - (layoutWidth - focusedMainBox!.width) / 2),
  ).toBeLessThanOrEqual(1);
});

test("keeps audio controls compact in the collection overview", async ({ page }) => {
  const state = await installMockApi(page);
  state.cards = [
    createCard("die Birne", "the pear"),
    createCard(
      { text: "die Pflaume", audio: audio("88888888-8888-4888-8888-888888888895") },
      { text: "the plum", audio: audio("88888888-8888-4888-8888-888888888896") },
    ),
  ];
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`/cards/${mockCollection.id}`);

  const cardItems = page.getByRole("listitem");
  const textCardBox = await cardItems.nth(0).boundingBox();
  const audioCardBox = await cardItems.nth(1).boundingBox();

  expect(textCardBox).not.toBeNull();
  expect(audioCardBox).not.toBeNull();
  expect(audioCardBox!.height).toBeLessThanOrEqual(textCardBox!.height + 4);
});

test("presents form dialogs as full-screen tasks on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await installMockApi(page);
  await page.goto(`/cards/${mockCollection.id}`);

  await page.getByRole("button", { name: "Karte hinzufügen" }).first().click();

  const dialog = page.getByRole("dialog", { name: "Karte erstellen" });
  await expectMobileFullscreenDialog(dialog, 320, 700);

  await dialog.getByRole("button", { name: "Zurück" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/cards/${mockCollection.id}/${state.cards[0]!.id}`);
  const editDialog = page.getByRole("dialog", { name: "Karte bearbeiten" });
  await editDialog.getByRole("button", { name: "Karte löschen" }).click();

  await expect
    .poll(async () => Math.round((await editDialog.boundingBox())?.height ?? 0))
    .toBeLessThan(700);

  await page.goto("/cards");
  await page.getByRole("button", { name: "Sammlung hinzufügen" }).click();
  const collectionDialog = page.getByRole("dialog", { name: "Sammlung erstellen" });
  await expectMobileFullscreenDialog(collectionDialog, 320, 700);
  await collectionDialog.getByRole("button", { name: "Zurück" }).click();

  await page.goto(`/cards/${mockCollection.id}`);
  await page.getByRole("button", { name: "Thema hinzufügen" }).click();
  const topicDialog = page.getByRole("dialog", { name: "Thema erstellen" });
  await expectMobileFullscreenDialog(topicDialog, 320, 700);
});

test("gives the Tutor dialog full-screen chrome and a pinned composer on mobile", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installMockApi(page);
  await page.goto("/review");
  await page.getByRole("button", { name: "Review starten" }).click();
  await page.getByRole("button", { name: "Antwort zeigen" }).click();
  await page.getByRole("button", { name: "Mit Tutopher reden" }).click();

  const dialog = page.getByRole("dialog", { name: "Tutopher" });
  await expectMobileFullscreenDialog(dialog, 320, 700);

  const composer = dialog.getByLabel("Deine Nachricht");
  const transcript = dialog.getByRole("region", { name: "Unterhaltung mit Tutopher" });
  const composerBox = await composer.boundingBox();
  expect(composerBox).not.toBeNull();
  await expect(composer).toHaveCSS("resize", "none");
  await expect(dialog.getByRole("button", { name: "Zur neuesten Nachricht" })).toBeHidden();

  // A transcript long enough to scroll must not push the composer anywhere.
  for (let exchange = 1; exchange <= 4; exchange += 1) {
    await dialog.getByRole("button", { name: "Einfach erklären" }).click();
    await expect(transcript.getByText("Ein Apfel ist eine Frucht.")).toHaveCount(exchange);
  }

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  for (const label of ["Einfach erklären", "Beispielsatz geben", "Merkhilfe finden"]) {
    const promptBox = await dialog.getByRole("button", { name: label }).boundingBox();
    expect(promptBox).not.toBeNull();
    expect(promptBox!.x).toBeGreaterThanOrEqual(dialogBox!.x);
    expect(promptBox!.x + promptBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
  }

  expect(await composer.boundingBox()).toEqual(composerBox);
  const transcriptBox = await transcript.boundingBox();
  await transcript.evaluate((element) => {
    (element as { scrollTop: number }).scrollTop = 0;
  });
  const latest = dialog.getByRole("button", { name: "Zur neuesten Nachricht" });
  await expect(latest).toBeVisible();
  expect(await transcript.boundingBox()).toEqual(transcriptBox);
  await expect(latest).toHaveCSS("position", "absolute");
  await expect(latest.locator("svg")).toBeVisible();
  if (browserName === "chromium") {
    await expect(page).toHaveScreenshot("tutor-latest-mobile.png", { animations: "disabled" });
  }

  await latest.click();
  await expect(latest).toBeHidden();
  await expect
    .poll(() =>
      transcript.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
      ),
    )
    .toBeLessThan(48);
  await dialog.getByRole("button", { name: "Zurück" }).click();
  await expect(dialog).toBeHidden();
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
    const state = await installMockApi(page, false);
    state.cards[0] = createCard(
      {
        text: "der Apfel",
        audio: audio("88888888-8888-4888-8888-888888888891"),
      },
      {
        text: "the apple",
        audio: audio("88888888-8888-4888-8888-888888888892"),
      },
    );
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
    await page.getByRole("button", { name: "Mit Tutopher reden" }).click();
    await expect(page.getByRole("heading", { name: "Tutopher" })).toBeVisible();
    await expect(page).toHaveScreenshot(`tutor-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: viewport.name === "mobile" ? "Zurück" : "Schließen" })
      .click();
    await page.getByRole("button", { name: /Gewusst/ }).click();
    await expect(page.getByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    await expect(page).toHaveScreenshot(`review-summary-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Fertig" }).click();
    await page.getByRole("link", { name: /Karten/ }).click();
    await expect(page.getByRole("heading", { name: "Karten" })).toBeVisible();
    await expect(page).toHaveScreenshot(`cards-${viewport.name}.png`, { animations: "disabled" });
    await page.getByRole("button", { name: "Sammlung hinzufügen" }).click();
    await expect(page.getByRole("heading", { name: "Sammlung erstellen" })).toBeVisible();
    await expect(page).toHaveScreenshot(`collection-editor-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: viewport.name === "mobile" ? "Zurück" : "Schließen" })
      .click();
    await page.getByRole("link", { name: /Vietnamesisch/ }).click();
    await expect(page.getByRole("heading", { name: "Vietnamesisch" })).toBeVisible();
    await expect(page).toHaveScreenshot(`collection-cards-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Thema hinzufügen" }).click();
    await expect(page.getByRole("heading", { name: "Thema erstellen" })).toBeVisible();
    await expect(page).toHaveScreenshot(`topic-editor-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: viewport.name === "mobile" ? "Zurück" : "Schließen" })
      .click();
    await page.getByRole("button", { name: "Karte hinzufügen" }).first().click();
    await expect(page.getByRole("heading", { name: "Karte erstellen" })).toBeVisible();
    await expect(page).toHaveScreenshot(`card-editor-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("combobox", { name: "Sammlung" }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page).toHaveScreenshot(`card-editor-collection-open-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("combobox", { name: "Sammlung" }).press("Escape");
    await page
      .getByRole("button", { name: viewport.name === "mobile" ? "Zurück" : "Schließen" })
      .click();
    await page.getByRole("link", { name: /Ich/ }).click();
    await expect(page.getByRole("heading", { name: "Khanhs Fortschritt" })).toBeVisible();
    await expect(page).toHaveScreenshot(`me-${viewport.name}.png`, { animations: "disabled" });

    state.cards[0] = createCard(
      { text: null, audio: audio("88888888-8888-4888-8888-888888888893") },
      { text: null, audio: audio("88888888-8888-4888-8888-888888888894") },
    );
    await page.goto("/review");
    await page.getByRole("button", { name: "Review starten" }).click();
    await expect(page.getByRole("button", { name: "Audio Vorderseite: Abspielen" })).toBeVisible();
    await expect(page).toHaveScreenshot(`review-audio-only-front-${viewport.name}.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Antwort zeigen" }).click();
    await expect(page.getByRole("button", { name: "Audio Rückseite: Abspielen" })).toBeVisible();
    await expect(page).toHaveScreenshot(`review-audio-only-back-${viewport.name}.png`, {
      animations: "disabled",
    });
  });
}
