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

describe("form dialog pending actions", () => {
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
    await user.type(screen.getByLabelText("Vorderseite Text bis 1.000 Zeichen"), "Schnee");
    await user.type(screen.getByLabelText("Rückseite Text bis 1.000 Zeichen"), "snow");
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
    renderApp(`/cards/${testCollections[1]!.id}`);

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

  it("blocks cancellation while deleting a Collection", async () => {
    const user = userEvent.setup();
    const requestGate = createRequestGate();
    mockServer.use(
      http.delete(`/api/collections/${testCollections[1]!.id}`, async () => {
        await requestGate.promise;

        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/cards/${testCollections[1]!.id}`);

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
