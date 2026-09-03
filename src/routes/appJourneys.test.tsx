import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { CreateCardInput } from "../contracts/card";
import type { CollectionInput } from "../contracts/collection";
import type { PronunciationInput } from "../contracts/pronunciation";
import { renderApp } from "../test/renderApp";
import {
  mockServer,
  testCards,
  testCollections,
  testGeneratedAudio,
  testTopics,
} from "../test/server";

function dialogByHeading(name: string) {
  const dialog = screen.getByRole("heading", { name }).closest("dialog");

  if (!dialog) throw new Error(`dialog ${name} missing`);

  return dialog;
}

async function cardDialogReady() {
  const dialog = dialogByHeading("Karte erstellen");

  await waitFor(() =>
    expect(within(dialog).getByLabelText("Vorderseite Maximal 1.000 Zeichen")).toHaveFocus(),
  );

  return dialog;
}

function audioSection(face: "Vorderseite" | "Rückseite") {
  return within(screen.getByRole("group", { name: `Audio für ${face}` }));
}

function languagePicker(face: "Vorderseite" | "Rückseite") {
  return screen.getByRole("combobox", { name: `Sprache der ${face}` });
}

async function chooseLanguage(
  user: ReturnType<typeof userEvent.setup>,
  face: "Vorderseite" | "Rückseite",
  option: string,
) {
  await user.click(languagePicker(face));
  await user.click(await screen.findByRole("option", { name: option }));
}

function summaryStat(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
}

function completedTutorReply(text: string) {
  return new HttpResponse(
    `event: delta\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: {"truncated":false}\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
}

function partialTutorReply(request: Request, onAbort: () => void) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('event: delta\ndata: {"text":"Teilantwort"}\n\n'),
      );
      request.signal.addEventListener(
        "abort",
        () => {
          onAbort();
          controller.close();
        },
        { once: true },
      );
    },
  });

  return new HttpResponse(stream, { headers: { "content-type": "text/event-stream" } });
}

describe("rendered app journeys", () => {
  it("logs in without trimming the shared password", async () => {
    const user = userEvent.setup();
    let submitted = "";
    mockServer.use(
      http.get("/api/session", () => HttpResponse.json({ authenticated: false })),
      http.post("/api/session", async ({ request }) => {
        submitted = ((await request.json()) as { password: string }).password;

        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderApp("/login");
    const input = await screen.findByLabelText("Passwort");
    await user.type(input, "  genau sechzehn+  ");
    await user.click(screen.getByRole("button", { name: "App öffnen" }));
    await screen.findByRole("heading", { name: "Wiederholen" });
    expect(submitted).toBe("  genau sechzehn+  ");
  });

  it("shows a traceable Fehler-ID when Login receives a backend error", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.get("/api/session", () => HttpResponse.json({ authenticated: false })),
      http.post("/api/session", () =>
        HttpResponse.json(
          {
            type: "/problems/unexpected",
            title: "Da ist etwas schiefgegangen",
            status: 500,
            instance: "urn:uuid:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          },
          { status: 500 },
        ),
      ),
    );
    await renderApp("/login");
    await user.type(await screen.findByLabelText("Passwort"), "richtiges Passwort");
    await user.click(screen.getByRole("button", { name: "App öffnen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die Anmeldung hat nicht funktioniert. Versuch es gleich noch einmal. (Fehler-ID: eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee)",
    );
  });

  it("shows connection copy without a Fehler-ID when Login receives no response", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.get("/api/session", () => HttpResponse.json({ authenticated: false })),
      http.post("/api/session", () => HttpResponse.error()),
    );
    await renderApp("/login");
    await user.type(await screen.findByLabelText("Passwort"), "richtiges Passwort");
    await user.click(screen.getByRole("button", { name: "App öffnen" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Keine Verbindung zur App. Versuch es gleich noch einmal.");
    expect(alert).not.toHaveTextContent("Fehler-ID");
  });

  it("retries a failed Session check instead of treating it as logged out", async () => {
    const user = userEvent.setup();
    let sessionAvailable = false;
    mockServer.use(
      http.get("/api/session", () =>
        sessionAvailable
          ? HttpResponse.json({ authenticated: true })
          : HttpResponse.json(
              {
                type: "/problems/unauthenticated",
                title: "Sitzung konnte nicht geprüft werden",
                status: 401,
                instance: "urn:uuid:11111111-1111-4111-8111-111111111111",
              },
              { status: 401 },
            ),
      ),
    );

    await renderApp("/");
    expect(await screen.findByRole("heading")).toHaveTextContent(
      "Die App konnte nicht geladen werden",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Versuch es gleich noch einmal. (Fehler-ID: 11111111-1111-4111-8111-111111111111)",
    );

    sessionAvailable = true;
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("heading", { name: "Wiederholen" })).toBeVisible();
  });

  it("finds Cards by either side while preserving diacritics", async () => {
    const user = userEvent.setup();
    await renderApp(`/cards/${testCollections[1]!.id}`);
    const search = await screen.findByLabelText("Karten durchsuchen");
    expect(screen.getByText("Café")).toBeVisible();
    await user.type(search, "kaffee");
    expect(screen.getByText("Café")).toBeVisible();
    await user.clear(search);
    await user.type(search, "café");
    expect(screen.getByText("Kaffeehaus")).toBeVisible();
    await user.clear(search);
    await user.type(search, "Cafe");
    expect(screen.getByText(/Keine Karte passt/)).toBeVisible();
  });

  it("opens a Collection from the overview and shows only its Cards", async () => {
    const user = userEvent.setup();
    await renderApp("/cards");

    expect(await screen.findByRole("link", { name: /Vietnamesisch/ })).toBeVisible();
    await user.click(screen.getByRole("link", { name: /Englisch/ }));

    expect(await screen.findByText("Café")).toBeVisible();
    expect(screen.queryByText("Take care")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Alle Sammlungen/ }));
    expect(await screen.findByRole("link", { name: /Vietnamesisch/ })).toBeVisible();
  });

  it("filters Cards in a Collection by Topic", async () => {
    const user = userEvent.setup();
    const withoutTopic = {
      ...testCards[0]!,
      id: "33333333-3333-4333-8333-333333333333",
      topicIds: [],
      front: "Hanoi",
      back: "Hà Nội",
    };
    mockServer.use(http.get("/api/cards", () => HttpResponse.json([testCards[0], withoutTopic])));
    await renderApp(`/cards/${testCollections[0]!.id}`);

    expect(await screen.findByText("Take care")).toBeVisible();
    expect(screen.getByText("Hanoi")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Tiere$/ }));
    expect(screen.getByText("Take care")).toBeVisible();
    expect(screen.queryByText("Hanoi")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Alle" }));
    expect(screen.getByText("Hanoi")).toBeVisible();
  });

  it("lets the Learner edit a Topic without filtering first", async () => {
    const user = userEvent.setup();
    await renderApp(`/cards/${testCollections[0]!.id}`);

    expect(await screen.findByRole("heading", { name: "Themen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tiere bearbeiten" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Tiere$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Tiere bearbeiten" }));
    expect(await screen.findByRole("heading", { name: "Thema umbenennen" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Tiere$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("creates a Card in the open Collection", async () => {
    const user = userEvent.setup();
    let created: { collectionId?: string } = {};
    mockServer.use(
      http.post("/api/cards", async ({ request }) => {
        created = (await request.json()) as { collectionId?: string };

        return HttpResponse.json({ ...testCards[1]!, front: "Schnee" }, { status: 201 });
      }),
    );
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    await user.type(await screen.findByLabelText("Vorderseite Maximal 1.000 Zeichen"), "Schnee");
    await user.type(screen.getByLabelText("Rückseite Maximal 1.000 Zeichen"), "snow");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(created.collectionId).toBe(testCollections[1]!.id));
  });

  it("creates a Topic from the Card dialog and keeps the Card dialog open", async () => {
    const user = userEvent.setup();
    const created = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      collectionId: testCollections[1]!.id,
      name: "Essen",
      icon: "food",
      createdAt: testTopics[0]!.createdAt,
      updatedAt: testTopics[0]!.updatedAt,
      deletedAt: null,
    };
    mockServer.use(
      http.post("/api/topics", async () => {
        mockServer.use(http.get("/api/topics", () => HttpResponse.json([created])));

        return HttpResponse.json(created, { status: 201 });
      }),
    );
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    const cardDialog = await cardDialogReady();
    await user.click(within(cardDialog).getByRole("combobox", { name: "Themen" }));
    await user.click(within(cardDialog).getByRole("option", { name: "Thema erstellen" }));

    expect(await screen.findByRole("heading", { name: "Thema erstellen" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Karte erstellen" })).toBeVisible();
    const topicDialog = dialogByHeading("Thema erstellen");
    await user.type(within(topicDialog).getByLabelText("Name des Themas"), "Essen");
    await user.click(within(topicDialog).getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Thema erstellen" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Karte erstellen" })).toBeVisible();
    expect(screen.getByLabelText("Essen entfernen")).toBeVisible();
  });

  it("creates a Collection from the Card dialog and selects it", async () => {
    const user = userEvent.setup();
    const created = {
      ...testCollections[0]!,
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      name: "Französisch",
      icon: "flag-vn",
    };
    mockServer.use(
      http.post("/api/collections", async () => {
        mockServer.use(
          http.get("/api/collections", () => HttpResponse.json([...testCollections, created])),
        );

        return HttpResponse.json(created, { status: 201 });
      }),
    );
    await renderApp(`/cards/${testCollections[0]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    const cardDialog = await cardDialogReady();
    await user.click(within(cardDialog).getByRole("combobox", { name: "Themen" }));
    await user.click(within(cardDialog).getByRole("option", { name: "Tiere" }));
    expect(within(cardDialog).getByLabelText("Tiere entfernen")).toBeVisible();

    await user.click(within(cardDialog).getByRole("combobox", { name: "Sammlung" }));
    await user.click(within(cardDialog).getByRole("option", { name: "Sammlung erstellen" }));

    expect(await screen.findByRole("heading", { name: "Sammlung erstellen" })).toBeVisible();
    const collectionDialog = dialogByHeading("Sammlung erstellen");
    await user.type(within(collectionDialog).getByLabelText("Name der Sammlung"), "Französisch");
    await user.click(within(collectionDialog).getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Sammlung erstellen" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("combobox", { name: "Sammlung" })).toHaveTextContent("Französisch");
    expect(screen.queryByLabelText("Tiere entfernen")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Karte erstellen" })).toBeVisible();
  });

  it("keeps the Card dialog open when the file picker is cancelled", async () => {
    const user = userEvent.setup();
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    const dialog = screen.getByRole("dialog");
    const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]');

    expect(fileInput).not.toBeNull();
    fireEvent(fileInput!, new Event("cancel", { bubbles: true, cancelable: true }));

    expect(dialog).toBeVisible();
    expect(screen.getByRole("heading", { name: "Karte erstellen" })).toBeVisible();
  });

  it("offers pronunciation generation on every face whose Collection declares a language it can speak", async () => {
    const user = userEvent.setup();
    await renderApp(`/cards/${testCollections[0]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    await cardDialogReady();

    expect(
      audioSection("Vorderseite").getByRole("button", { name: "Aussprache erzeugen" }),
    ).toBeVisible();
    expect(
      audioSection("Rückseite").getByRole("button", { name: "Aussprache erzeugen" }),
    ).toBeVisible();
  });

  it("offers no pronunciation generation for a face whose language is unset or unsupported", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.get("/api/collections", () =>
        HttpResponse.json([
          testCollections[0]!,
          { ...testCollections[1]!, frontLanguage: "fr-FR", backLanguage: null },
        ]),
      ),
    );
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    await cardDialogReady();

    expect(
      audioSection("Vorderseite").queryByRole("button", { name: "Aussprache erzeugen" }),
    ).not.toBeInTheDocument();
    expect(
      audioSection("Rückseite").queryByRole("button", { name: "Aussprache erzeugen" }),
    ).not.toBeInTheDocument();
  });

  it("generates a pronunciation from text the Learner may edit and attaches it to the face", async () => {
    const user = userEvent.setup();
    let spoken: PronunciationInput | undefined;
    let created: Partial<CreateCardInput> = {};
    mockServer.use(
      http.post("/api/pronunciations", async ({ request }) => {
        spoken = (await request.json()) as PronunciationInput;

        return HttpResponse.json(testGeneratedAudio, { status: 201 });
      }),
      http.post("/api/cards", async ({ request }) => {
        created = (await request.json()) as Partial<CreateCardInput>;

        return HttpResponse.json(testCards[0], { status: 201 });
      }),
    );
    await renderApp(`/cards/${testCollections[0]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    await cardDialogReady();
    await user.type(screen.getByLabelText("Vorderseite Maximal 1.000 Zeichen"), "xin chào");
    await user.type(screen.getByLabelText("Rückseite Maximal 1.000 Zeichen"), "hallo");

    const front = audioSection("Vorderseite");
    const text = front.getByLabelText("Text für die Aussprache");
    expect(text).toHaveValue("xin chào");

    await user.clear(text);
    await user.type(text, "chào");
    await user.click(front.getByRole("button", { name: "Aussprache erzeugen" }));

    expect(
      await front.findByRole("button", { name: "Audio Vorderseite: Abspielen" }),
    ).toBeVisible();
    expect(spoken).toEqual({ text: "chào", language: "vi-VN" });
    // Announced through the rail's status region, so the clip's arrival is heard, not only seen.
    expect(front.getByText("Aussprache erzeugt. Du kannst sie jetzt anhören.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(created.front).toEqual({ text: "xin chào", audioId: testGeneratedAudio.id }),
    );
  });

  it("refuses to save a Card while the pronunciation it is waiting for is still being generated", async () => {
    const user = userEvent.setup();
    let created: Partial<CreateCardInput> = {};
    let cardRequests = 0;
    let finishGeneration: () => void = () => undefined;
    const generation = new Promise<void>((resolve) => {
      finishGeneration = resolve;
    });
    mockServer.use(
      http.post("/api/pronunciations", async () => {
        await generation;

        return HttpResponse.json(testGeneratedAudio, { status: 201 });
      }),
      http.post("/api/cards", async ({ request }) => {
        cardRequests += 1;
        created = (await request.json()) as Partial<CreateCardInput>;

        return HttpResponse.json(testCards[0], { status: 201 });
      }),
    );
    await renderApp(`/cards/${testCollections[0]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    await cardDialogReady();
    await user.type(screen.getByLabelText("Vorderseite Maximal 1.000 Zeichen"), "xin chào");
    await user.type(screen.getByLabelText("Rückseite Maximal 1.000 Zeichen"), "hallo");

    const front = audioSection("Vorderseite");
    await user.click(front.getByRole("button", { name: "Aussprache erzeugen" }));
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die Aussprache wird noch erzeugt. Gleich kannst du speichern.",
    );
    expect(cardRequests).toBe(0);

    finishGeneration();
    expect(
      await front.findByRole("button", { name: "Audio Vorderseite: Abspielen" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(created.front).toEqual({ text: "xin chào", audioId: testGeneratedAudio.id }),
    );
  });

  it("leaves the Card as it was when a pronunciation cannot be generated", async () => {
    const user = userEvent.setup();
    let created: Partial<CreateCardInput> = {};
    mockServer.use(
      http.post("/api/pronunciations", () =>
        HttpResponse.json(
          {
            type: "/problems/pronunciation-failed",
            title: "Aussprache konnte nicht erzeugt werden",
            status: 502,
            instance: "urn:uuid:ffffffff-ffff-4fff-8fff-ffffffffffff",
          },
          { status: 502 },
        ),
      ),
      http.post("/api/cards", async ({ request }) => {
        created = (await request.json()) as Partial<CreateCardInput>;

        return HttpResponse.json(testCards[0], { status: 201 });
      }),
    );
    await renderApp(`/cards/${testCollections[0]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    await cardDialogReady();
    await user.type(screen.getByLabelText("Vorderseite Maximal 1.000 Zeichen"), "xin chào");
    await user.type(screen.getByLabelText("Rückseite Maximal 1.000 Zeichen"), "hallo");

    const front = audioSection("Vorderseite");
    await user.click(front.getByRole("button", { name: "Aussprache erzeugen" }));

    expect(await front.findByRole("alert")).toHaveTextContent(
      "Die Aussprache konnte nicht erzeugt werden. Versuch es gleich noch einmal.",
    );
    expect(
      front.queryByRole("button", { name: "Audio Vorderseite: Abspielen" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(created.front).toEqual({ text: "xin chào", audioId: null }));
  });

  it("says what a generated clip says, from the control that plays it", async () => {
    const user = userEvent.setup();
    await renderApp(`/cards/${testCollections[0]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Karte hinzufügen" }));
    await cardDialogReady();
    await user.type(screen.getByLabelText("Vorderseite Maximal 1.000 Zeichen"), "xin chào");
    await user.type(screen.getByLabelText("Rückseite Maximal 1.000 Zeichen"), "hallo");

    const front = audioSection("Vorderseite");
    const spokenTextField = front.getByLabelText("Text für die Aussprache");
    await user.clear(spokenTextField);
    await user.type(spokenTextField, "chào");
    await user.click(front.getByRole("button", { name: "Aussprache erzeugen" }));

    const player = await front.findByRole("button", { name: "Audio Vorderseite: Abspielen" });

    expect(front.getByText("Gesprochen: „chào“")).toBeVisible();
    // Read from the control it belongs to, so it is reachable without leaving the form.
    expect(player).toHaveAccessibleDescription("Gesprochen: „chào“");
  });

  it("says nothing about a Learner's own recording, whose content it does not know", async () => {
    const recordedCard = {
      ...testCards[0]!,
      front: {
        text: "xin chào",
        audio: {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          durationMs: 1_000,
          contentType: "audio/wav",
          byteSize: 8_044,
          synthesizedText: null,
        },
      },
    };
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([recordedCard])),
      http.get("/api/audio/:audioId", () => new HttpResponse(new Uint8Array([1]))),
    );
    await renderApp(`/cards/${testCollections[0]!.id}/${recordedCard.id}`);

    expect(await screen.findByLabelText("Vorderseite Maximal 1.000 Zeichen")).toHaveValue(
      "xin chào",
    );
    const front = audioSection("Vorderseite");
    const player = front.getByRole("button", { name: "Audio Vorderseite: Abspielen" });

    expect(player).toBeVisible();
    expect(front.queryByText(/Gesprochen/)).not.toBeInTheDocument();
    expect(player).toHaveAccessibleDescription("");
  });

  it("creates a Collection with the chosen icon and no declared language", async () => {
    const user = userEvent.setup();
    let created: Partial<CollectionInput> = {};
    mockServer.use(
      http.post("/api/collections", async ({ request }) => {
        created = (await request.json()) as Partial<CollectionInput>;

        return HttpResponse.json({ ...testCollections[0]!, ...created }, { status: 201 });
      }),
    );
    await renderApp("/cards");

    await user.click(await screen.findByRole("button", { name: "Sammlung hinzufügen" }));
    await user.type(await screen.findByLabelText("Name der Sammlung"), "Französisch");

    expect(screen.getByRole("radio", { name: "Standard" })).toBeChecked();
    expect(languagePicker("Vorderseite")).toHaveTextContent("Keine Angabe");
    expect(languagePicker("Rückseite")).toHaveTextContent("Keine Angabe");
    await user.click(screen.getByRole("radio", { name: "Vietnam" }));
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    // Byte for byte the request a Collection made before Collections had languages at all.
    await waitFor(() => expect(created).toEqual({ name: "Französisch", icon: "flag-vn" }));
  });

  it("creates a Collection that declares a language for each Card face", async () => {
    const user = userEvent.setup();
    let created: Partial<CollectionInput> = {};
    mockServer.use(
      http.post("/api/collections", async ({ request }) => {
        created = (await request.json()) as Partial<CollectionInput>;

        return HttpResponse.json({ ...testCollections[0]!, ...created }, { status: 201 });
      }),
    );
    await renderApp("/cards");

    await user.click(await screen.findByRole("button", { name: "Sammlung hinzufügen" }));
    await user.type(await screen.findByLabelText("Name der Sammlung"), "Vietnamesisch B1");
    await chooseLanguage(user, "Vorderseite", "Vietnamesisch");
    await chooseLanguage(user, "Rückseite", "Deutsch");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(created).toEqual({
        name: "Vietnamesisch B1",
        icon: "book",
        frontLanguage: "vi-VN",
        backLanguage: "de-DE",
      }),
    );
  });

  it("changes the declared languages of a Collection after it was created", async () => {
    const user = userEvent.setup();
    let updated: Partial<CollectionInput> = {};
    mockServer.use(
      http.patch(`/api/collections/${testCollections[0]!.id}`, async ({ request }) => {
        updated = (await request.json()) as Partial<CollectionInput>;

        return HttpResponse.json({ ...testCollections[0]!, ...updated });
      }),
    );
    await renderApp(`/cards/${testCollections[0]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Sammlung bearbeiten" }));
    await waitFor(() => expect(languagePicker("Vorderseite")).toHaveTextContent("Vietnamesisch"));
    expect(languagePicker("Rückseite")).toHaveTextContent("Deutsch");

    await chooseLanguage(user, "Vorderseite", "Englisch (USA)");
    await chooseLanguage(user, "Rückseite", "Keine Angabe");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(updated).toEqual({
        name: "Vietnamesisch",
        icon: "flag-vn",
        frontLanguage: "en-US",
        backLanguage: null,
      }),
    );
  });

  it("keeps a language this build cannot offer when the Learner only renames", async () => {
    const user = userEvent.setup();
    const foreign = { ...testCollections[1]!, frontLanguage: "en-GB", backLanguage: null };
    let updated: Partial<CollectionInput> = {};
    mockServer.use(
      http.get("/api/collections", () => HttpResponse.json([testCollections[0], foreign])),
      http.patch(`/api/collections/${foreign.id}`, async ({ request }) => {
        updated = (await request.json()) as Partial<CollectionInput>;

        return HttpResponse.json({ ...foreign, ...updated });
      }),
    );
    await renderApp(`/cards/${foreign.id}`);

    await user.click(await screen.findByRole("button", { name: "Sammlung bearbeiten" }));
    // No translated name exists for it, so it shows as the locale — visible, and still selected.
    await waitFor(() => expect(languagePicker("Vorderseite")).toHaveTextContent("en-GB"));

    const name = await screen.findByLabelText("Name der Sammlung");
    await user.clear(name);
    await user.type(name, "Englisch B1");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(updated).toEqual({ name: "Englisch B1", icon: "flag-gb" }));
  });

  it("closes an edited Collection without asking, and only confirms deletion", async () => {
    const user = userEvent.setup();
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Sammlung bearbeiten" }));
    await user.type(await screen.findByLabelText("Name der Sammlung"), " B1");
    await user.click(screen.getByRole("button", { name: "Schließen" }));

    await waitFor(() =>
      expect(screen.queryByLabelText("Name der Sammlung")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Sammlung bearbeiten" }));
    await user.click(await screen.findByRole("button", { name: "Sammlung löschen" }));

    expect(await screen.findByText(/Sammlung „Englisch“ löschen/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Schließen" })).not.toBeInTheDocument();

    // jsdom does not turn Escape into a dialog cancel, so raise the event the browser would.
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(await screen.findByLabelText("Name der Sammlung")).toHaveValue("Englisch");
  });

  it("renames a Collection from inside it", async () => {
    const user = userEvent.setup();
    let renamed = "";
    mockServer.use(
      http.patch(`/api/collections/${testCollections[1]!.id}`, async ({ request }) => {
        renamed = ((await request.json()) as { name: string }).name;

        return HttpResponse.json({ ...testCollections[1]!, name: renamed });
      }),
    );
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Sammlung bearbeiten" }));
    const name = await screen.findByLabelText("Name der Sammlung");
    await user.clear(name);
    await user.type(name, "Englisch B1");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(renamed).toBe("Englisch B1"));
  });

  it("reviews only the Cards of the started Collection", async () => {
    const user = userEvent.setup();
    await renderApp("/review");

    expect(await screen.findByRole("button", { name: /Englisch/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Vietnamesisch/ }));

    expect(await screen.findByText("Take care")).toBeVisible();
    expect(screen.getByText("1 / 1")).toBeVisible();
  });

  it("reviews only the Cards of the started Topic", async () => {
    const user = userEvent.setup();
    await renderApp("/review");

    await user.click(await screen.findByRole("button", { name: /Tiere/ }));
    expect(await screen.findByText("Take care")).toBeVisible();
    expect(screen.getByText("1 / 1")).toBeVisible();
  });

  it("shows one add Card action when a Collection has no saved Cards", async () => {
    mockServer.use(http.get("/api/cards", () => HttpResponse.json([])));

    await renderApp(`/cards/${testCollections[0]!.id}`);

    await screen.findByText("Noch keine Karten. Füge deine erste Karte hinzu.");
    expect(screen.getAllByRole("button", { name: "Karte hinzufügen" })).toHaveLength(1);
  });

  it("completes a reveal-and-Grade Review journey", async () => {
    const user = userEvent.setup();
    const firstCard = testCards[0]!;
    let recordedGrade = "";
    mockServer.use(
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { grade: string };
        recordedGrade = input.grade;

        return HttpResponse.json({
          review: {
            id: crypto.randomUUID(),
            cardId: firstCard.id,
            grade: input.grade,
            pointsAwarded: 10,
            boxBefore: 0,
            boxAfter: 1,
            reviewedAt: new Date().toISOString(),
            recordedAt: new Date().toISOString(),
          },
          card: { ...firstCard, box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("Take care")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    await waitFor(() => expect(recordedGrade).toBe("knew_it"));
  });

  it("shows Cards reviewed, Points earned, and the Streak Ich would report on the summary", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.get("/api/stats", () =>
        HttpResponse.json({
          totalPoints: 40,
          activeCardCount: 2,
          reviewsThisWeek: 3,
          currentStreak: 5,
          bestDay: null,
          dailyRecap: null,
        }),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(summaryStat("Reviews")).toHaveTextContent("1");
    expect(summaryStat("Punkte")).toHaveTextContent("10");
    expect(summaryStat("Streak")).toHaveTextContent("5");
  });

  it("refreshes a stale Streak once the Session's Review lands, so the summary matches Ich", async () => {
    const user = userEvent.setup();
    let streak = 2;
    mockServer.use(
      http.get("/api/stats", () =>
        HttpResponse.json({
          totalPoints: 0,
          activeCardCount: 2,
          reviewsThisWeek: 0,
          currentStreak: streak,
          bestDay: null,
          dailyRecap: null,
        }),
      ),
      http.post("/api/reviews", async ({ request }) => {
        streak = 3;
        const input = (await request.json()) as { cardId: string; grade: string };

        return HttpResponse.json({
          review: { ...input, id: crypto.randomUUID(), pointsAwarded: 10 },
          card: { ...testCards[0], box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();

    await waitFor(() => expect(summaryStat("Streak")).toHaveTextContent("3"));

    await user.click(screen.getByRole("link", { name: /Ich/ }));
    await screen.findByRole("heading", { name: "Khanhs Fortschritt" });
    expect(summaryStat("Streak")).toHaveTextContent("3");
  });

  it("keeps cumulative figures correct on the summary after a repeat round", async () => {
    const user = userEvent.setup();
    const secondCard = { ...testCards[1]!, dueAt: testCards[0]!.dueAt, front: "Second due Card" };
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([testCards[0], secondCard])),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { cardId: string; grade: string };

        return HttpResponse.json({
          review: { ...input, id: crypto.randomUUID(), pointsAwarded: 10 },
          card: { ...testCards[0], box: input.grade === "forgot" ? 0 : 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Vergessen" }));
    expect(await screen.findByText("Second due Card")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(summaryStat("Reviews")).toHaveTextContent("2");
    expect(summaryStat("Punkte")).toHaveTextContent("11");

    await user.click(await screen.findByRole("button", { name: "Vergessene wiederholen" }));
    expect(await screen.findByText("Take care")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(summaryStat("Reviews")).toHaveTextContent("3");
    expect(summaryStat("Punkte")).toHaveTextContent("21");
    expect(
      screen.queryByRole("button", { name: "Vergessene wiederholen" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fertig" }));
    expect(await screen.findByRole("button", { name: "Review starten" })).toBeVisible();
  });

  function multipleChoiceCard(id: string, front: string, back: string) {
    return {
      ...testCards[0]!,
      id,
      front,
      back,
    };
  }

  const multipleChoiceCards = [
    multipleChoiceCard("33333333-3333-4333-8333-333333333331", "eins", "one"),
    // Shares its front with the Card above rather than "zwei" (never asserted on screen), so these
    // four Cards can never assemble into a matching group of their own — these tests are for
    // multiple choice specifically, and matching's own coverage lives in its own describe block.
    multipleChoiceCard("33333333-3333-4333-8333-333333333332", "eins", "two"),
    multipleChoiceCard("33333333-3333-4333-8333-333333333333", "drei", "three"),
    multipleChoiceCard("33333333-3333-4333-8333-333333333334", "vier", "four"),
  ];

  it("records knew_it and resolves a multiple-choice Exercise on the first correct attempt", async () => {
    const user = userEvent.setup();
    let recordedGrade = "";
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(multipleChoiceCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { grade: string };
        recordedGrade = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...multipleChoiceCards[0], box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mit Tutopher reden" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "one" })).toBeVisible();
    expect(screen.getByRole("button", { name: "two" })).toBeVisible();
    expect(screen.getByRole("button", { name: "three" })).toBeVisible();
    expect(screen.getByRole("button", { name: "four" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "one" }));
    expect(await screen.findByText("Richtig!")).toBeVisible();
    expect(screen.getByRole("button", { name: /one.*richtig/ })).toBeDisabled();
    await waitFor(() => expect(recordedGrade).toBe("knew_it"));
    expect(screen.getByText("1 / 4")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Mit Tutopher reden" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("2 / 4")).toBeVisible();
  });

  it("kills a wrong option, re-asks, and records almost when the retry is correct", async () => {
    const user = userEvent.setup();
    let recordedGrade = "";
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(multipleChoiceCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { grade: string };
        recordedGrade = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 5, boxBefore: 0, boxAfter: 0 },
          card: { ...multipleChoiceCards[0], box: 0 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "two" }));
    const deadOption = await screen.findByRole("button", { name: /two.*falsch/ });

    expect(deadOption).toBeDisabled();
    expect(screen.queryByText("Richtig!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "one" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "one" }));
    expect(await screen.findByText("Richtig!")).toBeVisible();
    await waitFor(() => expect(recordedGrade).toBe("almost"));

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("2 / 4")).toBeVisible();
  });

  it("records forgot and reveals the correct option, never selected, after two misses", async () => {
    const user = userEvent.setup();
    let recordedGrade = "";
    let reviews = 0;
    let tutorRequestBody: unknown;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(multipleChoiceCards)),
      http.post("/api/reviews", async ({ request }) => {
        reviews += 1;
        const input = (await request.json()) as { grade: string };
        recordedGrade = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 1, boxBefore: 2, boxAfter: 0 },
          card: { ...multipleChoiceCards[0], box: 0 },
        });
      }),
      http.post("/api/tutor-replies", async ({ request }) => {
        tutorRequestBody = await request.json();

        return completedTutorReply("Weil du „three“ statt „one“ gewählt hast.");
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "two" }));
    await user.click(await screen.findByRole("button", { name: "three" }));

    expect(await screen.findByText("Leider falsch.")).toBeVisible();
    expect(screen.getByRole("button", { name: /one.*richtig/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /two.*falsch/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /three.*falsch/ })).toBeVisible();
    await waitFor(() => expect(recordedGrade).toBe("forgot"));
    expect(reviews).toBe(1);

    // A wrong resolution offers Tutopher too, and carries the Exercise's verdict and the option
    // that was actually chosen (the second, resolving pick — not the first knocked-out guess).
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.click(await screen.findByRole("button", { name: "Beispielsatz geben" }));
    await waitFor(() =>
      expect(tutorRequestBody).toMatchObject({
        subjectCardId: multipleChoiceCards[0]!.id,
        exerciseCards: [{ cardId: multipleChoiceCards[0]!.id, outcome: "forgot" }],
        chosenOptionText: "three",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Schließen" }));

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("2 / 4")).toBeVisible();
  });

  it("keeps the resolved multiple-choice Tutor explanation local when the subject Card's front is audio-only", async () => {
    const user = userEvent.setup();
    const audioId = "88888888-8888-4888-8888-888888888887";
    const metadata = { durationMs: 1_000, contentType: "audio/wav" as const, byteSize: 8_044 };
    const audioFrontCards = multipleChoiceCards.map((exerciseCard, index) =>
      index === 0
        ? { ...exerciseCard, front: { text: null, audio: { ...metadata, id: audioId } } }
        : exerciseCard,
    );
    let tutorRequests = 0;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(audioFrontCards)),
      http.get(`/api/audio/${audioId}`, () => new HttpResponse(new Uint8Array([1]))),
      http.post("/api/reviews", () =>
        HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...audioFrontCards[0], box: 1 },
        }),
      ),
      http.post("/api/tutor-replies", () => {
        tutorRequests += 1;

        return HttpResponse.json({});
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "one" }));
    expect(await screen.findByText("Richtig!")).toBeVisible();

    const tutor = await screen.findByRole("button", { name: "Mit Tutopher reden" });

    expect(tutor).toBeEnabled();
    await user.click(tutor);
    expect(await screen.findByText(/Tutopher kann Aufnahmen nicht anhören/)).toBeVisible();
    expect(tutorRequests).toBe(0);
  });

  function matchingCard(id: string, front: string, back: string) {
    return { ...testCards[0]!, id, front, back };
  }

  const matchingCards = [
    matchingCard("66666666-6666-4666-8666-666666666661", "eins", "one"),
    matchingCard("66666666-6666-4666-8666-666666666662", "zwei", "two"),
    matchingCard("66666666-6666-4666-8666-666666666663", "drei", "three"),
    matchingCard("66666666-6666-4666-8666-666666666664", "vier", "four"),
  ];

  it("clears four due Cards as one matching board, grading a clean run knew_it", async () => {
    const user = userEvent.setup();
    const recordedGrades: Record<string, string> = {};
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(matchingCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { cardId: string; grade: string };
        recordedGrades[input.cardId] = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...matchingCards[0], box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));

    expect(await screen.findByText("1 / 1")).toBeVisible();
    for (const [front, back] of [
      ["eins", "one"],
      ["zwei", "two"],
      ["drei", "three"],
      ["vier", "four"],
    ]) {
      await user.click(screen.getByRole("button", { name: front! }));
      await user.click(screen.getByRole("button", { name: back! }));
    }

    expect(await screen.findByText("Alle Paare gefunden!")).toBeVisible();
    await waitFor(() =>
      expect(Object.values(recordedGrades)).toEqual(["knew_it", "knew_it", "knew_it", "knew_it"]),
    );

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(summaryStat("Reviews")).toHaveTextContent("4");
  });

  it("grades almost for a Card caught in a mis-pairing, and never grades forgot", async () => {
    const user = userEvent.setup();
    const recordedGrades: Record<string, string> = {};
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(matchingCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { cardId: string; grade: string };
        recordedGrades[input.cardId] = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 5, boxBefore: 0, boxAfter: 0 },
          card: { ...matchingCards[0], box: 0 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    // "eins" paired against the wrong back taints both "eins" and "two"'s Cards.
    await user.click(screen.getByRole("button", { name: "eins" }));
    await user.click(screen.getByRole("button", { name: "two" }));
    expect(await screen.findByText("Das ist kein Paar. Versuch es noch einmal.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "eins" }));
    await user.click(screen.getByRole("button", { name: "one" }));
    await user.click(screen.getByRole("button", { name: "zwei" }));
    await user.click(screen.getByRole("button", { name: "two" }));
    await user.click(screen.getByRole("button", { name: "drei" }));
    await user.click(screen.getByRole("button", { name: "three" }));
    await user.click(screen.getByRole("button", { name: "vier" }));
    await user.click(screen.getByRole("button", { name: "four" }));

    await waitFor(() =>
      expect(recordedGrades).toMatchObject({
        [matchingCards[0]!.id]: "almost",
        [matchingCards[1]!.id]: "almost",
        [matchingCards[2]!.id]: "knew_it",
        [matchingCards[3]!.id]: "knew_it",
      }),
    );
    expect(Object.values(recordedGrades)).not.toContain("forgot");
  });

  it("pairs the same way when the back column starts the attempt", async () => {
    const user = userEvent.setup();
    const recordedGrades: Record<string, string> = {};
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(matchingCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { cardId: string; grade: string };
        recordedGrades[input.cardId] = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...matchingCards[0], box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    // Back first, then its front — the mirror of every other matching journey here.
    await user.click(screen.getByRole("button", { name: "one" }));
    await user.click(screen.getByRole("button", { name: "eins" }));

    await waitFor(() => expect(recordedGrades[matchingCards[0]!.id]).toBe("knew_it"));

    // A wrong pair started from the back is rejected the same way too, and taints both Cards.
    await user.click(screen.getByRole("button", { name: "three" }));
    await user.click(screen.getByRole("button", { name: "zwei" }));
    expect(await screen.findByText("Das ist kein Paar. Versuch es noch einmal.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "two" }));
    await user.click(screen.getByRole("button", { name: "zwei" }));

    await waitFor(() => expect(recordedGrades[matchingCards[1]!.id]).toBe("almost"));
  });

  it("keeps the Reviews for pairs already matched and drops nothing else when leaving mid-board", async () => {
    const user = userEvent.setup();
    let reviews = 0;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(matchingCards)),
      http.post("/api/reviews", () => {
        reviews += 1;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...matchingCards[0], box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "eins" }));
    await user.click(screen.getByRole("button", { name: "one" }));
    await user.click(screen.getByRole("button", { name: "zwei" }));
    await user.click(screen.getByRole("button", { name: "two" }));
    await waitFor(() => expect(reviews).toBe(2));

    await user.click(screen.getByRole("button", { name: "Review beenden" }));
    expect(await screen.findByRole("button", { name: "Review starten" })).toBeVisible();
    expect(reviews).toBe(2);
  });

  it("opens Tutopher for the tapped Card once the board has resolved, with the whole board's outcomes", async () => {
    const user = userEvent.setup();
    let tutorRequestBody: unknown;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(matchingCards)),
      http.post("/api/reviews", () =>
        HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...matchingCards[0], box: 1 },
        }),
      ),
      http.post("/api/tutor-replies", async ({ request }) => {
        tutorRequestBody = await request.json();

        return completedTutorReply("„eins“ heißt „one“.");
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    for (const [front, back] of [
      ["eins", "one"],
      ["zwei", "two"],
      ["drei", "three"],
      ["vier", "four"],
    ]) {
      await user.click(screen.getByRole("button", { name: front! }));
      await user.click(screen.getByRole("button", { name: back! }));
    }

    await screen.findByText("Alle Paare gefunden!");
    await user.click(screen.getByRole("button", { name: /eins/ }));
    await user.click(await screen.findByRole("button", { name: "Beispielsatz geben" }));

    await waitFor(() =>
      expect(tutorRequestBody).toMatchObject({
        subjectCardId: matchingCards[0]!.id,
        exerciseCards: [
          { cardId: matchingCards[0]!.id, outcome: "knew_it" },
          { cardId: matchingCards[1]!.id, outcome: "knew_it" },
          { cardId: matchingCards[2]!.id, outcome: "knew_it" },
          { cardId: matchingCards[3]!.id, outcome: "knew_it" },
        ],
        chosenOptionText: null,
      }),
    );
  });

  function swipeCard(id: string, front: string, back: string) {
    return { ...testCards[0]!, id, front, back };
  }

  // "zwei" and "drei" share a back, so whichever the shuffle picks as "eins"'s one distractor, the
  // visible text is always "haus" — and "haus" is excluded as a distractor for whichever of "zwei"
  // or "drei" is being planned, since it would equal that Card's own correct back, leaving "eins"'s
  // "one" as their only candidate. Every option pair is therefore deterministic regardless of the
  // random source, without needing to control it directly.
  const swipeCards = [
    swipeCard("77777777-7777-4777-8777-777777777771", "eins", "one"),
    swipeCard("77777777-7777-4777-8777-777777777772", "zwei", "haus"),
    swipeCard("77777777-7777-4777-8777-777777777773", "drei", "haus"),
  ];

  it("records knew_it, shows the resolution, and only advances after Weiter on a correct tap", async () => {
    const user = userEvent.setup();
    let recordedGrade = "";
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(swipeCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { grade: string };
        recordedGrade = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...swipeCards[0], box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));

    expect(await screen.findByText("eins")).toBeVisible();
    // One Swipe Card, then "zwei" and "drei" as Exercises of their own.
    expect(screen.getByText("1 / 3")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "one" }));

    expect(await screen.findByText("Richtig!")).toBeVisible();
    expect(screen.getByRole("button", { name: /one.*richtig/ })).toBeVisible();
    await waitFor(() => expect(recordedGrade).toBe("knew_it"));
    // Still on "eins" — every Exercise here pauses on its resolution until Weiter, Swipe included.
    expect(screen.getByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(await screen.findByText("zwei")).toBeVisible();
  });

  it("records forgot, shows the correct answer, and only advances after Weiter on a wrong tap", async () => {
    const user = userEvent.setup();
    let recordedGrade = "";
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(swipeCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { grade: string };
        recordedGrade = input.grade;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 1, boxBefore: 2, boxAfter: 0 },
          card: { ...swipeCards[0], box: 0 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "haus" }));

    expect(await screen.findByText("Leider falsch.")).toBeVisible();
    expect(screen.getByRole("button", { name: /one.*richtig/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /haus.*falsch/ })).toBeVisible();
    await waitFor(() => expect(recordedGrade).toBe("forgot"));
    expect(screen.getByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(await screen.findByText("zwei")).toBeVisible();
  });

  it("counts the Swipe Card as one Exercise and offers Tutopher its own chosen answer", async () => {
    const user = userEvent.setup();
    let tutorRequestBody: unknown;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(swipeCards)),
      http.post("/api/reviews", () =>
        HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...swipeCards[0], box: 1 },
        }),
      ),
      http.post("/api/tutor-replies", async ({ request }) => {
        tutorRequestBody = await request.json();

        return completedTutorReply("„eins“ heißt „one“.");
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "one" }));
    await user.click(screen.getByRole("button", { name: "Mit Tutopher reden" }));
    await user.click(await screen.findByRole("button", { name: "Beispielsatz geben" }));
    await waitFor(() =>
      expect(tutorRequestBody).toMatchObject({
        subjectCardId: swipeCards[0]!.id,
        // One Card per Swipe Exercise, so Tutopher hears about exactly the Card that was thrown.
        exerciseCards: [{ cardId: swipeCards[0]!.id, outcome: "knew_it" }],
        chosenOptionText: "one",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Schließen" }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    // "zwei" and "drei" follow as flip Cards: one distractor each is enough for Swipe, but the
    // Session has already spent its one grouped Exercise, and multiple choice needs three.
    await screen.findByText("zwei");
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    await screen.findByText("drei");
  });

  it("keeps the Review for the Card already swiped when leaving on its resolution", async () => {
    const user = userEvent.setup();
    let reviews = 0;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(swipeCards)),
      http.post("/api/reviews", () => {
        reviews += 1;

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...swipeCards[0], box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "one" }));
    await waitFor(() => expect(reviews).toBe(1));
    // Still on "eins"'s own resolution, never having tapped Weiter — the Review is already sent
    // regardless, which is exactly what leaving here is meant to prove keeps it.
    expect(screen.getByText("eins")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Review beenden" }));
    expect(await screen.findByRole("button", { name: "Review starten" })).toBeVisible();
    expect(reviews).toBe(1);
  });

  it("reaches Swipe on the next Session when this one could not form a grouped Exercise at all", async () => {
    // These four Cards share fronts, so no matching board can ever assemble from them, and each
    // finds three distractors, so Swipe passes them over while it is only matching's fallback. Left
    // alone that repeats forever: matching leads every Session and Swipe is never reached. The
    // Session remembers the kind that led it even when it planned neither, so the next one alternates.
    const user = userEvent.setup();
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(multipleChoiceCards)),
      http.post("/api/reviews", () =>
        HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...multipleChoiceCards[0], box: 1 },
        }),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();
    expect(screen.queryByText(/Ziehe die Karte/)).not.toBeInTheDocument();

    // Two multiple choice, then the no-three-in-a-row flip Card, then a last multiple choice.
    await user.click(screen.getByRole("button", { name: "one" }));
    await user.click(await screen.findByRole("button", { name: "Weiter" }));
    await user.click(await screen.findByRole("button", { name: "two" }));
    await user.click(await screen.findByRole("button", { name: "Weiter" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    await user.click(await screen.findByRole("button", { name: "four" }));
    await user.click(await screen.findByRole("button", { name: "Weiter" }));

    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Fertig" }));

    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText(/Ziehe die Karte/)).toBeVisible();
  });

  it("plans a mix of flip Cards and multiple-choice Exercises across Collections in one Session, demoting the third consecutive multiple choice to a flip Card", async () => {
    const user = userEvent.setup();
    const soloCard = {
      ...testCards[0]!,
      id: "44444444-4444-4444-8444-444444444444",
      collectionId: testCollections[1]!.id,
      front: "hello",
      back: "hallo",
    };
    let reviews = 0;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([...multipleChoiceCards, soloCard])),
      http.post("/api/reviews", async ({ request }) => {
        reviews += 1;
        const input = (await request.json()) as { grade: string };

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...multipleChoiceCards[0], box: 1, grade: input.grade },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("eins")).toBeVisible();
    expect(screen.getByText("1 / 5")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "one" }));
    await user.click(await screen.findByRole("button", { name: "Weiter" }));
    await user.click(await screen.findByRole("button", { name: "two" }));
    await user.click(await screen.findByRole("button", { name: "Weiter" }));

    // "drei" would be the third consecutive multiple-choice Exercise, so it is demoted to a flip
    // Card instead — the no-three-in-a-row rule at work.
    expect(await screen.findByText("drei")).toBeVisible();
    expect(screen.queryByRole("button", { name: "three" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    await user.click(await screen.findByRole("button", { name: "four" }));
    await user.click(await screen.findByRole("button", { name: "Weiter" }));

    expect(await screen.findByText("hello")).toBeVisible();
    expect(screen.queryByRole("button", { name: "one" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(reviews).toBe(5);
  });

  it("completes a Session entirely as flip Cards when the Sammlung is too small for multiple choice or Swipe", async () => {
    const user = userEvent.setup();
    // Two Cards sharing one back: neither can find a distinct-text distractor, so there is nothing
    // for multiple choice (needs three) or even Swipe (needs one) to build on — see the Swipe
    // journeys above for the case where one distractor does exist and turns this interactive.
    const tinyCollectionCards = [
      { ...testCards[0]!, id: "55555555-5555-4555-8555-555555555551", front: "eins", back: "one" },
      { ...testCards[0]!, id: "55555555-5555-4555-8555-555555555552", front: "zwei", back: "one" },
    ];
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(tinyCollectionCards)),
      http.post("/api/reviews", async ({ request }) => {
        const input = (await request.json()) as { grade: string };

        return HttpResponse.json({
          review: { id: crypto.randomUUID(), pointsAwarded: 10, boxBefore: 0, boxAfter: 1 },
          card: { ...tinyCollectionCards[0], box: 1, grade: input.grade },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));

    for (const front of ["eins", "zwei"]) {
      expect(await screen.findByText(front)).toBeVisible();
      expect(screen.queryByText("Wähle die richtige Übersetzung")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
      await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    }

    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
  });

  it("offers audio options for a Card with a recorded back, blocks grading while one fails to load, and offers Skip Card", async () => {
    const user = userEvent.setup();
    const metadata = { durationMs: 1_000, contentType: "audio/wav" as const, byteSize: 8_044 };
    const audioCard = (id: string, audioId: string, due: boolean) => ({
      ...testCards[0]!,
      id,
      front: "Frage",
      back: { text: null, audio: { ...metadata, id: audioId } },
      dueAt: due ? testCards[0]!.dueAt : "2099-01-01T00:00:00.000Z",
    });
    const target = audioCard(
      "99999999-9999-4999-8999-999999999991",
      "aaaaaaaa-9999-4aaa-8aaa-aaaaaaaaaaa1",
      true,
    );
    const siblings = [
      audioCard(
        "99999999-9999-4999-8999-999999999992",
        "aaaaaaaa-9999-4aaa-8aaa-aaaaaaaaaaa2",
        false,
      ),
      audioCard(
        "99999999-9999-4999-8999-999999999993",
        "aaaaaaaa-9999-4aaa-8aaa-aaaaaaaaaaa3",
        false,
      ),
      audioCard(
        "99999999-9999-4999-8999-999999999994",
        "aaaaaaaa-9999-4aaa-8aaa-aaaaaaaaaaa4",
        false,
      ),
    ];
    let reviews = 0;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([target, ...siblings])),
      http.get("/api/audio/:audioId", () => new HttpResponse(new Uint8Array([1]))),
      http.post("/api/reviews", () => {
        reviews += 1;

        return HttpResponse.json({});
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("Frage")).toBeVisible();
    expect(screen.getByText("Wähle die richtige Aufnahme")).toBeVisible();

    const chooseButtons = screen.getAllByRole("button", { name: /Option \d wählen/ });

    expect(chooseButtons).toHaveLength(4);
    // The front here has no recording of its own, so every rendered <audio> element is an option.
    const optionAudio = document.querySelectorAll("audio");

    expect(optionAudio).toHaveLength(4);

    fireEvent.error(optionAudio[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent("benötigte Audio");
    expect(chooseButtons[0]).toBeDisabled();
    expect(chooseButtons[1]).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Option 1: Erneut versuchen" }));
    fireEvent.playing(optionAudio[0]!);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(chooseButtons[1]).toBeEnabled();

    fireEvent.error(optionAudio[1]!);
    await user.click(await screen.findByRole("button", { name: "Karte überspringen" }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(reviews).toBe(0);
  });

  it("prefetches Review audio at low priority and skips an unavailable audio-only Card without grading", async () => {
    const user = userEvent.setup();
    const audioId = "88888888-8888-4888-8888-888888888888";
    const audioCard = {
      ...testCards[0]!,
      front: {
        text: null,
        audio: { id: audioId, durationMs: 1_000, contentType: "audio/wav", byteSize: 8_044 },
      },
      back: { text: "Antwort", audio: null },
    };
    let prefetched = 0;
    let reviews = 0;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([audioCard])),
      http.get(`/api/audio/${audioId}`, () => {
        prefetched += 1;

        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "audio/wav" },
        });
      }),
      http.post("/api/reviews", () => {
        reviews += 1;

        return HttpResponse.json({});
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await waitFor(() => expect(prefetched).toBe(1));
    const audio = document.querySelector("audio")!;

    fireEvent.error(audio);
    expect(await screen.findByRole("alert")).toHaveTextContent("benötigte Audio");
    await user.click(screen.getByRole("button", { name: "Audio Vorderseite: Erneut versuchen" }));
    fireEvent.playing(audio);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    fireEvent.error(audio);
    await user.click(screen.getByRole("button", { name: "Karte überspringen" }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(summaryStat("Reviews")).toHaveTextContent("0");
    expect(summaryStat("Punkte")).toHaveTextContent("0");
    expect(summaryStat("Streak")).toHaveTextContent("0");
    expect(reviews).toBe(0);
  });

  it("keeps the local mixed audio-only Tutor explanation available offline without a provider request", async () => {
    const user = userEvent.setup();
    const frontAudioId = "88888888-8888-4888-8888-888888888881";
    const metadata = { durationMs: 1_000, contentType: "audio/wav", byteSize: 8_044 };
    const audioCard = {
      ...testCards[0]!,
      front: { text: null, audio: { ...metadata, id: frontAudioId } },
      back: { text: "Antwort", audio: null },
    };
    let tutorRequests = 0;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([audioCard])),
      http.get("/api/audio/:audioId", () => new HttpResponse(new Uint8Array([1]))),
      http.post("/api/tutor-replies", () => {
        tutorRequests += 1;

        return HttpResponse.json({});
      }),
    );

    try {
      await renderApp("/review");
      await user.click(await screen.findByRole("button", { name: "Review starten" }));
      await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
      const tutor = await screen.findByRole("button", { name: "Mit Tutopher reden" });

      expect(tutor).toBeEnabled();
      await user.click(tutor);
      expect(await screen.findByText(/Tutopher kann Aufnahmen nicht anhören/)).toBeVisible();
      expect(tutorRequests).toBe(0);
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    }
  });

  it("keeps text-backed faces gradable after optional audio failure but blocks a failed audio-only back", async () => {
    const user = userEvent.setup();
    const metadata = { durationMs: 1_000, contentType: "audio/wav", byteSize: 8_044 };
    const first = {
      ...testCards[0]!,
      front: {
        text: "Text bleibt nutzbar",
        audio: { ...metadata, id: "88888888-8888-4888-8888-888888888883" },
      },
      back: { text: "Erste Antwort", audio: null },
    };
    const second = {
      ...testCards[0]!,
      id: "88888888-8888-4888-8888-888888888884",
      front: { text: "Zweite Frage", audio: null },
      back: {
        text: null,
        audio: { ...metadata, id: "88888888-8888-4888-8888-888888888885" },
      },
    };
    let reviews = 0;
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([first, second])),
      http.get("/api/audio/:audioId", () => new HttpResponse(new Uint8Array([1]))),
      http.post("/api/reviews", async ({ request }) => {
        reviews += 1;
        const input = (await request.json()) as { cardId: string; grade: string };

        return HttpResponse.json({
          review: { ...input, id: crypto.randomUUID(), pointsAwarded: 10 },
          card: { ...first, box: 1 },
        });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    const optionalAudio = document.querySelector("audio")!;

    expect(optionalAudio).not.toHaveAttribute("src");
    fireEvent.error(optionalAudio);
    expect(screen.getByRole("button", { name: "Antwort zeigen" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Zweite Frage")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    const requiredBackAudio = document.querySelector("audio")!;

    fireEvent.error(requiredBackAudio);
    expect(await screen.findByRole("group", { name: /Wie gut/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Audio Rückseite: Erneut versuchen" }));
    fireEvent.playing(requiredBackAudio);
    await waitFor(() => expect(screen.getByRole("group", { name: /Wie gut/ })).not.toBeDisabled());
    fireEvent.error(requiredBackAudio);
    await user.click(screen.getByRole("button", { name: "Karte überspringen" }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    expect(reviews).toBe(1);
  });

  it("discards active Review state after leaving the Review routes", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/review");

    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByRole("button", { name: "Antwort zeigen" })).toBeVisible();

    await act(async () => {
      await router.navigate({ to: "/cards" });
    });
    expect(await screen.findByRole("link", { name: /Vietnamesisch/ })).toBeVisible();

    await act(async () => {
      await router.navigate({ to: "/review/session" });
    });
    expect(await screen.findByRole("button", { name: "Review starten" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Antwort zeigen" })).not.toBeInTheDocument();
  });

  it("removes a rejected optimistic Grade and requeues a too-old Card", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/reviews", () =>
        HttpResponse.json(
          {
            type: "/problems/review-too-old",
            title: "Review ist zu alt",
            status: 422,
            instance: "urn:uuid:33333333-3333-4333-8333-333333333333",
          },
          { status: 422 },
        ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die Bewertung war zu alt und wurde nicht gespeichert",
    );
    expect(screen.getByText("Take care")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Gut gemacht!" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review beenden" }));
    expect(await screen.findByLabelText("0 Punkte")).toBeVisible();
  });

  it("keeps a replay conflict visible with its correlated request ID", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/reviews", () =>
        HttpResponse.json(
          {
            type: "/problems/review-replay-conflict",
            title: "Review muss neu geladen werden",
            status: 409,
            instance: "urn:uuid:44444444-4444-4444-8444-444444444444",
          },
          { status: 409 },
        ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fehler-ID: 44444444-4444-4444-8444-444444444444");
    expect(screen.queryByRole("button", { name: /Gewusst/ })).not.toBeInTheDocument();
  });

  it("removes a remotely deleted Card and continues with the repaired queue", async () => {
    const user = userEvent.setup();
    const secondCard = {
      ...testCards[1],
      dueAt: testCards[0]!.dueAt,
      front: "Second due Card",
    };
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([testCards[0], secondCard])),
      http.post("/api/reviews", () =>
        HttpResponse.json(
          {
            type: "/problems/card-not-found",
            title: "Karte nicht gefunden",
            status: 404,
            instance: "urn:uuid:66666666-6666-4666-8666-666666666666",
          },
          { status: 404 },
        ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("aus der Wiederholung entfernt");
    expect(screen.getByText("Second due Card")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review beenden" }));
    expect(await screen.findByLabelText("0 Punkte")).toBeVisible();
  });

  it("keeps the next ungraded Card current when an earlier too-old Grade rejects late", async () => {
    const user = userEvent.setup();
    const cards = [
      testCards[0]!,
      { ...testCards[1]!, dueAt: testCards[0]!.dueAt, front: "Second due Card" },
      {
        ...testCards[1]!,
        id: "99999999-9999-4999-8999-999999999999",
        dueAt: testCards[0]!.dueAt,
        front: "Third due Card",
      },
    ];
    let callCount = 0;
    let releaseFirst!: () => void;
    const firstResponse = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(cards)),
      http.post("/api/reviews", async () => {
        callCount += 1;
        if (callCount === 1) {
          await firstResponse;

          return HttpResponse.json(
            {
              type: "/problems/review-too-old",
              title: "Review ist zu alt",
              status: 422,
              instance: "urn:uuid:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
            { status: 422 },
          );
        }

        return HttpResponse.json({});
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Second due Card")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Third due Card")).toBeVisible();

    releaseFirst();
    expect(await screen.findByRole("alert")).toHaveTextContent("zu alt");
    expect(screen.getByText("Third due Card")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Take care")).toBeVisible();
  });

  it("does not revisit later graded Cards when an earlier deleted Grade rejects late", async () => {
    const user = userEvent.setup();
    const cards = [
      testCards[0]!,
      { ...testCards[1]!, dueAt: testCards[0]!.dueAt, front: "Second due Card" },
      {
        ...testCards[1]!,
        id: "99999999-9999-4999-8999-999999999998",
        dueAt: testCards[0]!.dueAt,
        front: "Third due Card",
      },
    ];
    let callCount = 0;
    let releaseFirst!: () => void;
    const firstResponse = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(cards)),
      http.post("/api/reviews", async () => {
        callCount += 1;
        if (callCount === 1) {
          await firstResponse;

          return HttpResponse.json(
            {
              type: "/problems/card-not-found",
              title: "Karte nicht gefunden",
              status: 404,
              instance: "urn:uuid:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            },
            { status: 404 },
          );
        }

        return HttpResponse.json({});
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Second due Card")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Third due Card")).toBeVisible();

    releaseFirst();
    expect(await screen.findByRole("alert")).toHaveTextContent("gelöscht");
    expect(screen.getByText("Third due Card")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
  });

  it("pauses on a device-clock rejection after reversing the optimistic Grade", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/reviews", () =>
        HttpResponse.json(
          {
            type: "/problems/device-clock-ahead",
            title: "Gerätezeit prüfen",
            status: 422,
            instance: "urn:uuid:77777777-7777-4777-8777-777777777777",
          },
          { status: 422 },
        ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Datum oder Uhrzeit auf deinem Gerät",
    );
    expect(screen.getByRole("region", { name: "Kartenrückseite" })).toHaveTextContent("Pass auf");
    expect(screen.queryByRole("button", { name: /Gewusst/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review beenden" }));
    expect(await screen.findByLabelText("0 Punkte")).toBeVisible();
  });

  it("does not let a late rejection mutate a newer Review Session", async () => {
    const user = userEvent.setup();
    const cards = [
      testCards[0]!,
      { ...testCards[1]!, dueAt: testCards[0]!.dueAt, front: "Second due Card" },
    ];
    let releaseReview!: () => void;
    let responseReleased = false;
    const delayedReview = new Promise<void>((resolve) => {
      releaseReview = resolve;
    });
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json(cards)),
      http.post("/api/reviews", async () => {
        await delayedReview;
        responseReleased = true;

        return HttpResponse.json(
          {
            type: "/problems/review-too-old",
            title: "Review ist zu alt",
            status: 422,
            instance: "urn:uuid:cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          },
          { status: 422 },
        );
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Second due Card")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review beenden" }));
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("Take care")).toBeVisible();

    releaseReview();
    await waitFor(() => expect(responseReleased).toBe(true));
    expect(screen.getByText("Take care")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("aborts pending Grades and discards Review state on Logout", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    let requestAborted = false;
    mockServer.use(
      http.post("/api/reviews", async ({ request }) => {
        await new Promise<void>((resolve) => {
          request.signal.addEventListener(
            "abort",
            () => {
              requestAborted = true;
              resolve();
            },
            { once: true },
          );
        });

        return HttpResponse.json({});
      }),
      http.delete("/api/session", () => new HttpResponse(null, { status: 204 })),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    await user.click(screen.getByRole("link", { name: /Ich/ }));
    await user.click(await screen.findByRole("button", { name: "Abmelden" }));

    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeVisible();
    await waitFor(() => expect(requestAborted).toBe(true));
    expect(confirm).toHaveBeenCalledWith(
      "1 Bewertung ist noch nicht gespeichert. Trotzdem abmelden?",
    );
    confirm.mockRestore();
  });

  it("treats a Grade 401 only as Session expiry", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/reviews", () =>
        HttpResponse.json(
          {
            type: "/problems/unauthenticated",
            title: "Anmeldung erforderlich",
            status: 401,
            instance: "urn:uuid:dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          },
          { status: 401 },
        ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByText(/Du wurdest abgemeldet/)).toBeVisible();
    expect(screen.queryByText("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).not.toBeInTheDocument();
  });

  it("uses message copy for the Tutor conversation controls", async () => {
    const user = userEvent.setup();
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));

    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    const composer = await screen.findByLabelText("Deine Nachricht");

    expect(composer).toBeVisible();
    expect(getComputedStyle(composer).resize).toBe("none");
    expect(screen.getByRole("button", { name: "Senden" })).toBeVisible();
  });

  it("sends a flip Card's Exercise with no outcome and no chosen option", async () => {
    const user = userEvent.setup();
    let tutorRequestBody: unknown;
    mockServer.use(
      http.post("/api/tutor-replies", async ({ request }) => {
        tutorRequestBody = await request.json();

        return completedTutorReply("Antwort");
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() =>
      expect(tutorRequestBody).toMatchObject({
        subjectCardId: testCards[0]!.id,
        exerciseCards: [{ cardId: testCards[0]!.id, outcome: null }],
        chosenOptionText: null,
      }),
    );
  });

  it("offers a floating return to the newest Tutor message only while browsing earlier messages", async () => {
    const user = userEvent.setup();
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));

    const transcript = screen.getByRole("region", { name: "Unterhaltung mit Tutopher" });
    Object.defineProperties(transcript, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 600 },
      scrollTop: { configurable: true, value: 400, writable: true },
    });

    expect(
      screen.queryByRole("button", { name: "Zur neuesten Nachricht" }),
    ).not.toBeInTheDocument();

    transcript.scrollTop = 100;
    fireEvent.scroll(transcript);
    expect(screen.getByRole("button", { name: "Zur neuesten Nachricht" })).toBeVisible();

    transcript.scrollTop = 400;
    fireEvent.scroll(transcript);
    expect(
      screen.queryByRole("button", { name: "Zur neuesten Nachricht" }),
    ).not.toBeInTheDocument();

    transcript.scrollTop = 100;
    fireEvent.scroll(transcript);
    const latest = screen.getByRole("button", { name: "Zur neuesten Nachricht" });
    await user.click(latest);
    expect(
      screen.queryByRole("button", { name: "Zur neuesten Nachricht" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the Tutor Conversation when the Learner closes and reopens the same Card", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/tutor-replies", () => completedTutorReply("Das ist die Antwort.")),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText("Das ist die Antwort.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Schließen" }));
    await user.click(screen.getByRole("button", { name: "Mit Tutopher reden" }));

    expect(await screen.findByText("Warum?")).toBeVisible();
    expect(screen.getByText("Das ist die Antwort.")).toBeVisible();
  });

  it("stops a Tutor Conversation after eight Learner messages until it starts over", async () => {
    const user = userEvent.setup();
    const requests: Array<{
      message: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }> = [];
    mockServer.use(
      http.post("/api/tutor-replies", async ({ request }) => {
        requests.push((await request.json()) as (typeof requests)[number]);

        return completedTutorReply(`Antwort ${requests.length}`);
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));

    expect(screen.queryByText(/Du kannst noch .* Nachrichten senden\./)).not.toBeInTheDocument();

    for (let exchange = 1; exchange <= 8; exchange += 1) {
      await user.type(screen.getByLabelText("Deine Nachricht"), `Nachricht ${exchange}`);
      await user.click(screen.getByRole("button", { name: "Senden" }));
      await screen.findByText(`Antwort ${exchange}`);

      if (exchange === 4)
        expect(
          screen.queryByText(/Du kannst noch .* Nachrichten senden\./),
        ).not.toBeInTheDocument();
      if (exchange === 5)
        expect(screen.getByText("Du kannst noch 3 Nachrichten senden.")).toBeVisible();
    }

    expect(requests).toHaveLength(8);
    expect(requests[7]).toEqual({
      message: "Nachricht 8",
      subjectCardId: testCards[0]!.id,
      exerciseCards: [{ cardId: testCards[0]!.id, outcome: null }],
      chosenOptionText: null,
      messages: [
        { role: "user", content: "Nachricht 1" },
        { role: "assistant", content: "Antwort 1" },
        { role: "user", content: "Nachricht 2" },
        { role: "assistant", content: "Antwort 2" },
        { role: "user", content: "Nachricht 3" },
        { role: "assistant", content: "Antwort 3" },
        { role: "user", content: "Nachricht 4" },
        { role: "assistant", content: "Antwort 4" },
        { role: "user", content: "Nachricht 5" },
        { role: "assistant", content: "Antwort 5" },
        { role: "user", content: "Nachricht 6" },
        { role: "assistant", content: "Antwort 6" },
        { role: "user", content: "Nachricht 7" },
        { role: "assistant", content: "Antwort 7" },
      ],
    });

    const composer = screen.getByLabelText("Deine Nachricht");
    expect(composer).toBeDisabled();
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
    expect(
      screen.getByText("Diese Unterhaltung ist voll. Beginne neu, um weiterzuschreiben."),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Schließen" }));
    await user.click(screen.getByRole("button", { name: "Mit Tutopher reden" }));
    expect(screen.getByLabelText("Deine Nachricht")).toBeDisabled();
    expect(screen.getByText("Nachricht 1")).toBeVisible();
    expect(screen.getByText("Antwort 8")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Neu beginnen" }));
    expect(screen.getByLabelText("Deine Nachricht")).toBeEnabled();
    expect(screen.queryByText("Nachricht 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Antwort 8")).not.toBeInTheDocument();
    expect(screen.queryByText(/Du kannst noch .* Nachrichten senden\./)).not.toBeInTheDocument();
  });

  it("starts a fresh Tutor Conversation after advancing to another Card", async () => {
    const user = userEvent.setup();
    const secondCard = {
      ...testCards[1]!,
      dueAt: testCards[0]!.dueAt,
      front: "Second due Card",
    };
    mockServer.use(
      http.get("/api/cards", () => HttpResponse.json([testCards[0], secondCard])),
      http.post("/api/tutor-replies", () => completedTutorReply("Erste Antwort")),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Erste Frage");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText("Erste Antwort")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Schließen" }));

    await user.click(screen.getByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Second due Card")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));

    expect(screen.queryByText("Erste Frage")).not.toBeInTheDocument();
    expect(screen.queryByText("Erste Antwort")).not.toBeInTheDocument();
  });

  it("starts a fresh Tutor Conversation when a forgotten Card repeats", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/tutor-replies", () => completedTutorReply("Antwort aus Runde eins")),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Frage aus Runde eins");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText("Antwort aus Runde eins")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Schließen" }));

    await user.click(screen.getByRole("button", { name: "Vergessen" }));
    await user.click(await screen.findByRole("button", { name: "Vergessene wiederholen" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));

    expect(screen.queryByText("Frage aus Runde eins")).not.toBeInTheDocument();
    expect(screen.queryByText("Antwort aus Runde eins")).not.toBeInTheDocument();
  });

  it("aborts and rolls back a partial Tutor reply when the dialog closes", async () => {
    const user = userEvent.setup();
    let requestAborted = false;
    mockServer.use(
      http.post("/api/tutor-replies", ({ request }) =>
        partialTutorReply(request, () => {
          requestAborted = true;
        }),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Abgebrochene Frage");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText("Teilantwort")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Schließen" }));
    await waitFor(() => expect(requestAborted).toBe(true));
    await user.click(screen.getByRole("button", { name: "Mit Tutopher reden" }));

    expect(screen.queryByText("Abgebrochene Frage")).not.toBeInTheDocument();
    expect(screen.queryByText("Teilantwort")).not.toBeInTheDocument();
  });

  it("aborts a partial Tutor reply when navigation unmounts the dialog", async () => {
    const user = userEvent.setup();
    let requestAborted = false;
    mockServer.use(
      http.post("/api/tutor-replies", ({ request }) =>
        partialTutorReply(request, () => {
          requestAborted = true;
        }),
      ),
    );
    const { router } = await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Abgebrochene Frage");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText("Teilantwort")).toBeVisible();

    await act(async () => {
      await router.navigate({ to: "/review" });
    });
    await waitFor(() => expect(requestAborted).toBe(true));
  });

  it("announces a Tutor reply only after streaming completes", async () => {
    const user = userEvent.setup();
    let finishReply!: () => void;
    mockServer.use(
      http.post("/api/tutor-replies", () => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Ganze Antwort"}\n\n'));
            finishReply = () => {
              controller.enqueue(encoder.encode('event: done\ndata: {"truncated":false}\n\n'));
              controller.close();
            };
          },
        });

        return new HttpResponse(stream, { headers: { "content-type": "text/event-stream" } });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Bitte erklären");
    await user.click(screen.getByRole("button", { name: "Senden" }));

    const partialReply = await screen.findByText("Ganze Antwort");
    expect(partialReply.closest("div")).not.toHaveAttribute("aria-live");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    act(() => finishReply());
    expect(await screen.findByRole("status")).toHaveTextContent("Tutopher: Ganze Antwort");
  });

  it("guides a fresh Tutor Conversation and keeps prompt chips available after a reply", async () => {
    const user = userEvent.setup();
    mockServer.use(http.post("/api/tutor-replies", () => completedTutorReply("Ein Beispiel")));
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));

    const dialog = screen.getByRole("dialog", { name: "Tutopher" });
    const warning = within(dialog).getByText("Tutopher ist eine KI und kann Fehler machen.");
    const promptHint = within(dialog).getByText("Tippe auf eine Frage – sie wird sofort gesendet.");
    const dataFlow = within(dialog).getByText(
      "Nachrichten werden zur Beantwortung an OpenAI gesendet.",
    );
    const transcript = dataFlow.parentElement;
    const emptyStateAvatar = dialog.querySelector('svg[viewBox="0 0 64 64"]');

    expect(transcript).not.toContainElement(warning);
    expect(transcript).toContainElement(dataFlow);
    expect(promptHint).toBeVisible();
    expect(emptyStateAvatar).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Einfach erklären" }));

    const reply = await within(dialog).findByText("Ein Beispiel");
    const replyArticle = reply.closest("article");

    expect(warning).toBeVisible();
    expect(
      within(dialog).queryByText("Nachrichten werden zur Beantwortung an OpenAI gesendet."),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByText("Khanh")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Einfach erklären" })).toBeEnabled();
    expect(replyArticle).toHaveAccessibleName("Tutopher");
    expect(replyArticle?.querySelector("svg")).toBeVisible();
    expect(within(replyArticle as HTMLElement).queryByText("Tutopher")).not.toBeInTheDocument();
  });

  it("discards a partial failed Tutor answer and retains the question for retry", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post(
        "/api/tutor-replies",
        () =>
          new HttpResponse(
            'event: delta\ndata: {"text":"Teilantwort"}\n\nevent: error\ndata: {"type":"/problems/tutor-failed"}\n\n',
            { headers: { "content-type": "text/event-stream" } },
          ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    const question = await screen.findByLabelText("Deine Nachricht");
    await user.type(question, "Warum ist das so?");
    await user.click(screen.getByRole("button", { name: "Senden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Versuch es noch einmal");
    expect(screen.queryByText("Teilantwort")).not.toBeInTheDocument();
    expect(question).toHaveValue("Warum ist das so?");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeEnabled();
  });

  it("expires the shared Session when a Tutor request returns 401", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/tutor-replies", () =>
        HttpResponse.json(
          {
            type: "/problems/unauthenticated",
            title: "Anmeldung erforderlich",
            status: 401,
            instance: "urn:uuid:55555555-5555-4555-8555-555555555555",
          },
          { status: 401 },
        ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Senden" }));

    expect(await screen.findByText(/Du wurdest abgemeldet/)).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Tutopher" })).not.toBeInTheDocument();
  });

  it("uses the Tutor limit Retry-After integer as a disabled retry countdown", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/tutor-replies", () =>
        HttpResponse.json(
          {
            type: "/problems/tutor-session-limit",
            title: "Tutopher braucht eine Pause",
            status: 429,
            instance: "urn:uuid:88888888-8888-4888-8888-888888888888",
          },
          { status: 429, headers: { "Retry-After": "2" } },
        ),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));
    await user.type(await screen.findByLabelText("Deine Nachricht"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Senden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("(2 s)");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeDisabled();
  });

  it("reacts when a Card crosses its Due boundary on focus", async () => {
    let currentTime = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => currentTime);
    mockServer.use(
      http.get("/api/cards", () =>
        HttpResponse.json([
          { ...testCards[0], dueAt: new Date(currentTime + 60_000).toISOString() },
        ]),
      ),
    );
    await renderApp("/review");
    expect(await screen.findByText("Heute ist nichts fällig.")).toBeVisible();

    currentTime += 60_001;
    await act(() => window.dispatchEvent(new Event("focus")));
    expect(await screen.findByRole("button", { name: "Review starten" })).toBeEnabled();
    nowSpy.mockRestore();
  });

  it("shows the current Streak beside the other figures on Ich, never in the header", async () => {
    mockServer.use(
      http.get("/api/stats", () =>
        HttpResponse.json({
          totalPoints: 40,
          activeCardCount: 2,
          reviewsThisWeek: 3,
          currentStreak: 4,
          bestDay: null,
          dailyRecap: null,
        }),
      ),
    );
    await renderApp("/me");

    expect(await screen.findByRole("heading", { name: "Khanhs Fortschritt" })).toBeVisible();
    const streakTile = screen.getByText("Streak", { exact: true }).closest("div");

    if (!streakTile) throw new Error("Streak tile missing");
    expect(within(streakTile).getByText("4")).toBeVisible();
    expect(
      within(screen.getByRole("banner")).queryByText("Streak", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("shows a Streak of zero for a Learner with no Review history", async () => {
    mockServer.use(
      http.get("/api/stats", () =>
        HttpResponse.json({
          totalPoints: 0,
          activeCardCount: 2,
          reviewsThisWeek: 0,
          currentStreak: 0,
          bestDay: null,
          dailyRecap: null,
        }),
      ),
    );
    await renderApp("/me");

    expect(await screen.findByRole("heading", { name: "Khanhs Fortschritt" })).toBeVisible();
    const streakTile = screen.getByText("Streak", { exact: true }).closest("div");

    if (!streakTile) throw new Error("Streak tile missing");
    expect(within(streakTile).getByText("0")).toBeVisible();
  });
});
