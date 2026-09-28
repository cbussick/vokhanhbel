import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "../i18n/config";
import { LanguageSelect } from "./LanguageSelect";

function LanguageSelectHarness({ initialValue = null }: { initialValue?: string | null }) {
  const [value, setValue] = useState(initialValue);

  return (
    <>
      <label htmlFor="language">Sprache</label>
      <LanguageSelect id="language" value={value} onChange={setValue} />
      <button type="button">Danach</button>
    </>
  );
}

describe("LanguageSelect", () => {
  it("offers null as a selectable value, not a placeholder or an empty string", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LanguageSelect id="language" value="vi-VN" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Keine Angabe" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("retains an unknown locale as the selected, selectable option", async () => {
    const user = userEvent.setup();
    render(<LanguageSelectHarness initialValue="fr-CA" />);
    const trigger = screen.getByRole("combobox", { name: "Sprache" });

    expect(trigger).toHaveTextContent("fr-CA");
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "fr-CA" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}{Escape}");
    expect(trigger).toHaveTextContent("fr-CA");

    await user.click(trigger);
    await user.keyboard("{Home}");
    await user.tab();
    expect(trigger).toHaveTextContent("Keine Angabe");
    expect(screen.getByRole("button", { name: "Danach" })).toHaveFocus();
  });

  it("selects a Face Language by keyboard while keeping focus on the trigger", async () => {
    const user = userEvent.setup();
    render(<LanguageSelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Sprache" });

    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(trigger).toHaveTextContent("Vietnamesisch");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves the existing basic navigation without typeahead or paging", async () => {
    const user = userEvent.setup();
    render(<LanguageSelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Sprache" });

    trigger.focus();
    await user.keyboard("v");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await user.keyboard("{PageDown}{Alt>}{ArrowUp}{/Alt}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Keine Angabe" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("associates help text and disables interaction when requested", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <p id="language-help">Optional für diese Kartenseite.</p>
        <LanguageSelect
          id="language"
          describedBy="language-help"
          value={null}
          onChange={onChange}
          disabled
        />
      </>,
    );
    const trigger = screen.getByRole("combobox");

    expect(trigger).toHaveAccessibleDescription("Optional für diese Kartenseite.");
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
