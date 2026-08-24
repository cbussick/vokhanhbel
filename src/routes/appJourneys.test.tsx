import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "../test/renderApp";
import { mockServer, testCards, testCollections, testTopics } from "../test/server";

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

function completedTutorReply(text: string) {
  return new HttpResponse(
    `event: delta\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: {"truncated":false}\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
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

  it("creates a Collection with the chosen icon", async () => {
    const user = userEvent.setup();
    let created: { name?: string; icon?: string } = {};
    mockServer.use(
      http.post("/api/collections", async ({ request }) => {
        created = (await request.json()) as { name?: string; icon?: string };

        return HttpResponse.json({ ...testCollections[0]!, ...created }, { status: 201 });
      }),
    );
    await renderApp("/cards");

    await user.click(await screen.findByRole("button", { name: "Sammlung hinzufügen" }));
    await user.type(await screen.findByLabelText("Name der Sammlung"), "Französisch");

    expect(screen.getByRole("radio", { name: "Standard" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Vietnam" }));
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(created).toEqual({ name: "Französisch", icon: "flag-vn" }));
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
    expect(screen.getByText(/0 Reviews · 0 Punkte/)).toBeVisible();
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
      http.post("/api/cards/:cardId/tutor-replies", () => {
        tutorRequests += 1;

        return HttpResponse.json({});
      }),
    );

    try {
      await renderApp("/review");
      await user.click(await screen.findByRole("button", { name: "Review starten" }));
      await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
      const tutor = await screen.findByRole("button", { name: "Tutopher fragen" });

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

  it("keeps the Tutor Conversation when the Learner closes and reopens the same Card", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/cards/:cardId/tutor-replies", () =>
        completedTutorReply("Das ist die Antwort."),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Fragen" }));
    expect(await screen.findByText("Das ist die Antwort.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Schließen" }));
    await user.click(screen.getByRole("button", { name: "Tutopher fragen" }));

    expect(await screen.findByText("Warum?")).toBeVisible();
    expect(screen.getByText("Das ist die Antwort.")).toBeVisible();
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
      http.post("/api/cards/:cardId/tutor-replies", () => completedTutorReply("Erste Antwort")),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Erste Frage");
    await user.click(screen.getByRole("button", { name: "Fragen" }));
    expect(await screen.findByText("Erste Antwort")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Schließen" }));

    await user.click(screen.getByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByText("Second due Card")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));

    expect(screen.queryByText("Erste Frage")).not.toBeInTheDocument();
    expect(screen.queryByText("Erste Antwort")).not.toBeInTheDocument();
  });

  it("starts a fresh Tutor Conversation when a forgotten Card repeats", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/cards/:cardId/tutor-replies", () =>
        completedTutorReply("Antwort aus Runde eins"),
      ),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Frage aus Runde eins");
    await user.click(screen.getByRole("button", { name: "Fragen" }));
    expect(await screen.findByText("Antwort aus Runde eins")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Schließen" }));

    await user.click(screen.getByRole("button", { name: "Vergessen" }));
    await user.click(await screen.findByRole("button", { name: "Vergessene wiederholen" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));

    expect(screen.queryByText("Frage aus Runde eins")).not.toBeInTheDocument();
    expect(screen.queryByText("Antwort aus Runde eins")).not.toBeInTheDocument();
  });

  it("aborts and rolls back a partial Tutor reply when the dialog closes", async () => {
    const user = userEvent.setup();
    let requestAborted = false;
    mockServer.use(
      http.post("/api/cards/:cardId/tutor-replies", ({ request }) => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('event: delta\ndata: {"text":"Teilantwort"}\n\n'),
            );
            request.signal.addEventListener(
              "abort",
              () => {
                requestAborted = true;
                controller.close();
              },
              { once: true },
            );
          },
        });

        return new HttpResponse(stream, { headers: { "content-type": "text/event-stream" } });
      }),
    );
    await renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Abgebrochene Frage");
    await user.click(screen.getByRole("button", { name: "Fragen" }));
    expect(await screen.findByText("Teilantwort")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Schließen" }));
    await waitFor(() => expect(requestAborted).toBe(true));
    await user.click(screen.getByRole("button", { name: "Tutopher fragen" }));

    expect(screen.queryByText("Abgebrochene Frage")).not.toBeInTheDocument();
    expect(screen.queryByText("Teilantwort")).not.toBeInTheDocument();
  });

  it("announces a Tutor reply only after streaming completes", async () => {
    const user = userEvent.setup();
    let finishReply!: () => void;
    mockServer.use(
      http.post("/api/cards/:cardId/tutor-replies", () => {
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
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Bitte erklären");
    await user.click(screen.getByRole("button", { name: "Fragen" }));

    const partialReply = await screen.findByText("Ganze Antwort");
    expect(partialReply.closest("div")).not.toHaveAttribute("aria-live");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    act(() => finishReply());
    expect(await screen.findByRole("status")).toHaveTextContent("Tutopher: Ganze Antwort");
  });

  it("discards a partial failed Tutor answer and retains the question for retry", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post(
        "/api/cards/:cardId/tutor-replies",
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
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    const question = await screen.findByLabelText("Deine Frage");
    await user.type(question, "Warum ist das so?");
    await user.click(screen.getByRole("button", { name: "Fragen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Versuch es noch einmal");
    expect(screen.queryByText("Teilantwort")).not.toBeInTheDocument();
    expect(question).toHaveValue("Warum ist das so?");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeEnabled();
  });

  it("expires the shared Session when a Tutor request returns 401", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/cards/:cardId/tutor-replies", () =>
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
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Fragen" }));

    expect(await screen.findByText(/Du wurdest abgemeldet/)).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Tutopher" })).not.toBeInTheDocument();
  });

  it("uses the Tutor limit Retry-After integer as a disabled retry countdown", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/cards/:cardId/tutor-replies", () =>
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
    await user.click(await screen.findByRole("button", { name: "Tutopher fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Fragen" }));

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
});
