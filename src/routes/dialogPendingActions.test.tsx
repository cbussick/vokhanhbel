import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CardFormDialog } from "../components/CardFormDialog";
import { queryKeys } from "../lib/queryKeys";
import { renderApp } from "../test/renderApp";
import { mockServer, testCards, testCollections } from "../test/server";

function createRequestGate() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((release) => {
    resolve = release;
  });

  return { promise, resolve };
}

function renderCardDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.collections, testCollections);

  return render(
    <QueryClientProvider client={queryClient}>
      <CardFormDialog defaultCollectionId={testCollections[1]!.id} onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

describe("shared dialog chrome and pending actions", () => {
  it("freezes the Card dialog and blocks dismissal while saving", async () => {
    const user = userEvent.setup();
    const requestGate = createRequestGate();
    mockServer.use(
      http.post("/api/cards", async () => {
        await requestGate.promise;

        return HttpResponse.json(
          { ...testCards[1]!, front: "Schnee", back: "snow" },
          { status: 201 },
        );
      }),
    );
    renderCardDialog();
    const dialog = await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Vorderseite Maximal 1.000 Zeichen"), "Schnee");
    await user.type(screen.getByLabelText("Rückseite Maximal 1.000 Zeichen"), "snow");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    const pendingSave = await within(dialog).findByRole("button", {
      name: "Wird gespeichert …",
    });
    expect(pendingSave).toHaveAttribute("aria-disabled", "true");
    expect(dialog.querySelector("section")).toHaveAttribute("aria-busy", "true");
    within(dialog)
      .getAllByRole("button")
      .filter((button) => button !== pendingSave)
      .forEach((button) => expect(button).toBeDisabled());
    within(dialog)
      .getAllByRole("textbox")
      .forEach((input) => expect(input).toBeDisabled());
    expect(within(dialog).getByRole("combobox", { name: "Sammlung" })).toBeDisabled();

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).toBeVisible();

    requestGate.resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("restores the Collection dialog after a failed save", async () => {
    const user = userEvent.setup();
    const requestGate = createRequestGate();
    mockServer.use(
      http.patch(`/api/collections/${testCollections[1]!.id}`, async () => {
        await requestGate.promise;

        return HttpResponse.json({}, { status: 500 });
      }),
    );
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Sammlung bearbeiten" }));
    const dialog = screen.getByRole("dialog");
    const name = screen.getByLabelText("Name der Sammlung");
    await user.clear(name);
    await user.type(name, "Englisch B1");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await within(dialog).findByRole("button", { name: "Wird gespeichert …" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(name).toBeDisabled();
    within(dialog)
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).toBeDisabled());

    requestGate.resolve();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Die Sammlung konnte nicht gespeichert werden.",
    );
    expect(within(dialog).getByRole("button", { name: "Speichern" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Schließen" })).toBeEnabled();
    expect(name).toBeEnabled();
  });

  it("gives the Tutor dialog the shared close affordances and cancel handling", async () => {
    const user = userEvent.setup();
    await renderApp("/review");

    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));

    const dialog = screen.getByRole("dialog", { name: "Tutopher" });
    expect(within(dialog).getByRole("button", { name: "Schließen" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Zurück" })).toBeEnabled();

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tutopher" })).not.toBeInTheDocument(),
    );
  });

  it("gives the audio-only Tutor explanation the shared dialog chrome", async () => {
    const user = userEvent.setup();
    const metadata = { durationMs: 1_000, contentType: "audio/wav", byteSize: 8_044 };
    mockServer.use(
      http.get("/api/cards", () =>
        HttpResponse.json([
          {
            ...testCards[0]!,
            front: {
              text: null,
              audio: { ...metadata, id: "88888888-8888-4888-8888-888888888881" },
            },
            back: { text: "Antwort", audio: null },
          },
        ]),
      ),
      http.get("/api/audio/:audioId", () => new HttpResponse(new Uint8Array([1]))),
    );
    await renderApp("/review");

    await user.click(await screen.findByRole("button", { name: "Review starten" }));
    await user.click(await screen.findByRole("button", { name: "Antwort zeigen" }));
    await user.click(await screen.findByRole("button", { name: "Mit Tutopher reden" }));

    const dialog = screen.getByRole("dialog", { name: "Tutopher" });
    expect(within(dialog).getByText(/Tutopher kann Aufnahmen nicht anhören/)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Schließen" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Zurück" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "Zurück" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tutopher" })).not.toBeInTheDocument(),
    );
  });

  it("blocks cancellation while deleting a Collection", async () => {
    const user = userEvent.setup();
    const requestGate = createRequestGate();
    mockServer.use(
      http.delete(`/api/collections/${testCollections[1]!.id}`, async () => {
        await requestGate.promise;

        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderApp(`/cards/${testCollections[1]!.id}`);

    await user.click(await screen.findByRole("button", { name: "Sammlung bearbeiten" }));
    await user.click(screen.getByRole("button", { name: "Sammlung löschen" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Sammlung löschen" }));

    expect(await within(dialog).findByRole("button", { name: "Wird gelöscht …" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toBeDisabled();

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(within(dialog).getByText(/Sammlung „Englisch“ löschen/)).toBeVisible();

    requestGate.resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
