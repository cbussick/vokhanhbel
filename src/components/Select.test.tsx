import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select, type SelectOption } from "./Select";

const options: readonly SelectOption[] = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta", icon: <svg role="img" aria-label="Decoration" /> },
];

function SingleSelectHarness({ onCreate = vi.fn() }: { onCreate?: () => void }) {
  const [value, setValue] = useState("alpha");

  return (
    <>
      <label htmlFor="choice">Auswahl</label>
      <Select
        id="choice"
        options={options}
        value={value}
        onChange={setValue}
        action={{ label: "Alpha erstellen", onSelect: onCreate }}
      />
      <button type="button">Danach</button>
    </>
  );
}

describe("Select", () => {
  it("renders text with an optional decorative icon in both options and the selected value", async () => {
    const user = userEvent.setup();
    render(<SingleSelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Auswahl" });

    expect(trigger.querySelector("svg")).toBeNull();
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Alpha" }).querySelector("svg")).toBeNull();
    const beta = screen.getByRole("option", { name: "Beta" });
    expect(beta.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await user.click(beta);
    expect(trigger).toHaveTextContent("Beta");
    expect(trigger.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("distinguishes no selection from both null and a literal string option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const nullableOptions: SelectOption<string | null>[] = [
      { value: null, label: "Keine Angabe" },
      { value: "null", label: "Wörtlich null" },
    ];
    const { rerender } = render(
      <Select
        id="choice"
        options={nullableOptions}
        value={undefined}
        onChange={onChange}
        placeholder="Bitte wählen"
      />,
    );
    const trigger = screen.getByRole("combobox");

    expect(trigger).toHaveTextContent("Bitte wählen");
    await user.click(trigger);
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Keine Angabe" }));
    expect(onChange).toHaveBeenLastCalledWith(null);

    rerender(
      <Select
        id="choice"
        options={nullableOptions}
        value={null}
        onChange={onChange}
        placeholder="Bitte wählen"
      />,
    );
    expect(trigger).toHaveTextContent("Keine Angabe");
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Keine Angabe" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("option", { name: "Wörtlich null" }));
    expect(onChange).toHaveBeenLastCalledWith("null");
  });

  it("dismisses on an outside pointer or focus leaving without committing the active option", async () => {
    const user = userEvent.setup();
    render(<SingleSelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Auswahl" });
    const outside = screen.getByRole("button", { name: "Danach" });

    await user.click(trigger);
    await user.keyboard("{ArrowDown}");
    await user.click(outside);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Alpha");

    await user.click(trigger);
    await user.keyboard("{ArrowDown}");
    act(() => outside.focus());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Alpha");
  });

  it("keeps active and selected options distinct for pointer navigation too", async () => {
    const user = userEvent.setup();
    render(<SingleSelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Auswahl" });

    await user.click(trigger);
    const beta = screen.getByRole("option", { name: "Beta" });
    fireEvent.pointerMove(beta, { pointerType: "mouse" });
    expect(beta).toHaveAttribute("data-active", "true");
    expect(beta).toHaveAttribute("aria-selected", "false");
    expect(trigger).toHaveAttribute("aria-activedescendant", beta.id);
    expect(trigger).toHaveTextContent("Alpha");
    await user.keyboard("{Enter}");
    expect(trigger).toHaveTextContent("Beta");
  });

  it("excludes the action from typeahead but allows deliberate keyboard activation", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SingleSelectHarness onCreate={onCreate} />);
    const trigger = screen.getByRole("combobox", { name: "Auswahl" });

    await user.click(trigger);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("a");
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("option", { name: "Alpha erstellen" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await user.keyboard("{Enter}");
    expect(onCreate).not.toHaveBeenCalled();

    await user.click(trigger);
    await user.keyboard("{End}{Enter}");
    expect(onCreate).toHaveBeenCalledOnce();
    expect(trigger).toHaveTextContent("Alpha");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("toggles a membership without losing values outside the current option list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        id="choice"
        options={options}
        multiple
        value={["unavailable", "alpha"]}
        onChange={onChange}
        placeholder="Hinzufügen"
      />,
    );
    const trigger = screen.getByRole("combobox");

    expect(trigger).toHaveTextContent("Hinzufügen");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["unavailable"]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not toggle multiple selection on Tab or Alt+ArrowUp", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select id="choice" options={options} multiple value={[]} onChange={onChange} />);
    const trigger = screen.getByRole("combobox");

    await user.click(trigger);
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(trigger);
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables an empty list or an explicitly disabled control, including its action", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCreate = vi.fn();
    const { rerender } = render(
      <Select id="choice" options={[]} value={undefined} onChange={onChange} />,
    );
    const trigger = screen.getByRole("combobox");

    expect(trigger).toBeDisabled();
    rerender(
      <Select
        id="choice"
        options={options}
        value="alpha"
        onChange={onChange}
        action={{ label: "Erstellen", onSelect: onCreate }}
        disabled
      />,
    );
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
