import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "../test/renderApp";
import { mockServer, testCards } from "../test/server";

describe("rendered V1 journeys", () => {
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
    renderApp("/login");
    const input = await screen.findByLabelText("Passwort");
    await user.type(input, "  genau sechzehn+  ");
    await user.click(screen.getByRole("button", { name: "App öffnen" }));
    await screen.findByRole("heading", { name: "Wiederholen" });
    expect(submitted).toBe("  genau sechzehn+  ");
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

    renderApp("/");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Deine Sitzung konnte nicht überprüft werden",
    );

    sessionAvailable = true;
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("heading", { name: "Wiederholen" })).toBeVisible();
  });

  it("finds Cards by either side while preserving diacritics", async () => {
    const user = userEvent.setup();
    renderApp("/cards");
    const search = await screen.findByLabelText("Karten durchsuchen");
    expect(screen.getByText("Take care")).toBeVisible();
    await user.type(search, "kaffee");
    expect(screen.getByText("Café")).toBeVisible();
    await user.clear(search);
    await user.type(search, "Cafe");
    expect(screen.getByText(/Keine Karte passt/)).toBeVisible();
  });

  it("shows one add Card action when there are no saved Cards", async () => {
    mockServer.use(http.get("/api/cards", () => HttpResponse.json([])));

    renderApp("/cards");

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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByText("Take care")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    expect(await screen.findByRole("heading", { name: "Gut gemacht!" })).toBeVisible();
    await waitFor(() => expect(recordedGrade).toBe("knew_it"));
  });

  it("discards active Review state after leaving the Review routes", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/review");

    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    expect(await screen.findByRole("button", { name: "Antwort zeigen" })).toBeVisible();

    await act(async () => {
      await router.navigate({ to: "/cards" });
    });
    expect(await screen.findByLabelText("Karten durchsuchen")).toBeVisible();

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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bitte bewerte die Karte noch einmal",
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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("44444444-4444-4444-8444-444444444444");
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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("anderen Gerät gelöscht");
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
    renderApp("/review");
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
    renderApp("/review");
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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Gerätezeit");
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
    renderApp("/review");
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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));
    await user.click(screen.getByRole("link", { name: /Ich/ }));
    await user.click(await screen.findByRole("button", { name: "Abmelden" }));

    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeVisible();
    await waitFor(() => expect(requestAborted).toBe(true));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("1"));
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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: /Gewusst/ }));

    expect(await screen.findByText(/Deine Sitzung ist abgelaufen/)).toBeVisible();
    expect(screen.queryByText("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).not.toBeInTheDocument();
  });

  it("discards a partial failed Khunhphap answer and retains the question for retry", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post(
        "/api/cards/:cardId/khunhphap-replies",
        () =>
          new HttpResponse(
            'event: delta\ndata: {"text":"Teilantwort"}\n\nevent: error\ndata: {"type":"/problems/khunhphap-failed"}\n\n',
            { headers: { "content-type": "text/event-stream" } },
          ),
      ),
    );
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Khunhphap fragen" }));
    const question = await screen.findByLabelText("Deine Frage");
    await user.type(question, "Warum ist das so?");
    await user.click(screen.getByRole("button", { name: "Fragen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Versuch es noch einmal");
    expect(screen.queryByText("Teilantwort")).not.toBeInTheDocument();
    expect(question).toHaveValue("Warum ist das so?");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeEnabled();
  });

  it("expires the shared Session when a Khunhphap request returns 401", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/cards/:cardId/khunhphap-replies", () =>
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
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Khunhphap fragen" }));
    await user.type(await screen.findByLabelText("Deine Frage"), "Warum?");
    await user.click(screen.getByRole("button", { name: "Fragen" }));

    expect(await screen.findByText(/Deine Sitzung ist abgelaufen/)).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Khunhphap" })).not.toBeInTheDocument();
  });

  it("uses the Khunhphap limit Retry-After integer as a disabled retry countdown", async () => {
    const user = userEvent.setup();
    mockServer.use(
      http.post("/api/cards/:cardId/khunhphap-replies", () =>
        HttpResponse.json(
          {
            type: "/problems/khunhphap-session-limit",
            title: "Khunhphap braucht eine Pause",
            status: 429,
            instance: "urn:uuid:88888888-8888-4888-8888-888888888888",
          },
          { status: 429, headers: { "Retry-After": "2" } },
        ),
      ),
    );
    renderApp("/review");
    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(screen.getByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Khunhphap fragen" }));
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
    renderApp("/review");
    expect(await screen.findByText("Heute ist nichts fällig.")).toBeVisible();

    currentTime += 60_001;
    await act(() => window.dispatchEvent(new Event("focus")));
    expect(await screen.findByRole("button", { name: "Review starten" })).toBeEnabled();
    nowSpy.mockRestore();
  });
});
