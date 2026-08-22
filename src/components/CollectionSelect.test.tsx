import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "../i18n/config";
import { collectionListSchema } from "../contracts/collection";
import { testCollections } from "../test/server";
import { CollectionSelect } from "./CollectionSelect";

const collections = collectionListSchema.parse(testCollections);

function CollectionSelectHarness() {
  const [value, setValue] = useState(collections[0]!.id);

  return (
    <>
      <label htmlFor="collection">Sammlung</label>
      <CollectionSelect
        id="collection"
        collections={collections}
        value={value}
        onChange={setValue}
        required
      />
      <button type="button">Danach</button>
    </>
  );
}

describe("CollectionSelect", () => {
  it("exposes the selected Collection and supports keyboard selection", async () => {
    const user = userEvent.setup();
    render(<CollectionSelectHarness />);
    const combobox = screen.getByRole("combobox", { name: "Sammlung" });

    expect(combobox).toHaveTextContent("Vietnamesisch");
    expect(combobox).toHaveAttribute("aria-required", "true");

    await user.click(combobox);
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(screen.getByRole("option", { name: "Vietnamesisch" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.keyboard("{ArrowDown}{Enter}");
    expect(combobox).toHaveTextContent("Englisch");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(combobox).toHaveFocus();
  });

  it("closes without changing the value and supports type-ahead", async () => {
    const user = userEvent.setup();
    render(<CollectionSelectHarness />);
    const combobox = screen.getByRole("combobox", { name: "Sammlung" });

    await user.click(combobox);
    await user.keyboard("{ArrowDown}{Escape}");
    expect(combobox).toHaveTextContent("Vietnamesisch");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("e");
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(screen.getByRole("option", { name: "Englisch" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(combobox).toHaveTextContent("Vietnamesisch");

    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox).toHaveTextContent("Englisch");
    expect(screen.getByRole("button", { name: "Danach" })).toHaveFocus();
  });

  it("offers Sammlung erstellen without changing the selected Collection", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <>
        <label htmlFor="collection">Sammlung</label>
        <CollectionSelect
          id="collection"
          collections={collections}
          value={collections[0]!.id}
          onChange={() => undefined}
          onCreate={onCreate}
          required
        />
      </>,
    );
    const combobox = screen.getByRole("combobox", { name: "Sammlung" });

    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Sammlung erstellen" }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(combobox).toHaveTextContent("Vietnamesisch");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
