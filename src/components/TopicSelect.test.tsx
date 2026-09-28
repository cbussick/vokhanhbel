import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "../i18n/config";
import { topicListSchema } from "../contracts/topic";
import { testTopics } from "../test/server";
import { TopicSelect } from "./TopicSelect";

const topics = topicListSchema.parse([
  ...testTopics,
  { ...testTopics[0], id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", name: "Essen", icon: "food" },
]);

function TopicSelectHarness() {
  const [value, setValue] = useState<string[]>([]);

  return (
    <>
      <label htmlFor="topics">Themen</label>
      <TopicSelect id="topics" topics={topics} value={value} onChange={setValue} />
      <button type="button">Danach</button>
    </>
  );
}

describe("TopicSelect", () => {
  it("adds a Topic as a chip from the listbox", async () => {
    const user = userEvent.setup();
    render(<TopicSelectHarness />);
    const combobox = screen.getByRole("combobox", { name: "Themen" });

    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Tiere" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Tiere entfernen")).toBeVisible();

    await user.click(combobox);
    expect(screen.getByRole("option", { name: "Tiere" })).toHaveAttribute("aria-selected", "true");
  });

  it("toggles multiple memberships and removes a chip without removing other Topics", async () => {
    const user = userEvent.setup();
    render(<TopicSelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Themen" });

    for (const topic of topics) {
      await user.click(trigger);
      await user.click(screen.getByRole("option", { name: topic.name }));
    }
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getAllByRole("option", { selected: true })).toHaveLength(topics.length);

    await user.click(screen.getByRole("option", { name: topics[0]!.name }));
    expect(screen.queryByLabelText(`${topics[0]!.name} entfernen`)).not.toBeInTheDocument();
    expect(screen.getByLabelText(`${topics[1]!.name} entfernen`)).toBeVisible();
    await user.click(screen.getByLabelText(`${topics[1]!.name} entfernen`));
    expect(screen.queryByLabelText(`${topics[1]!.name} entfernen`)).not.toBeInTheDocument();
  });

  it("opens at the first Topic and only dismisses on Tab instead of toggling membership", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCreate = vi.fn();
    render(
      <>
        <TopicSelect
          id="topics"
          topics={topics}
          value={[topics[1]!.id]}
          onChange={onChange}
          onCreate={onCreate}
        />
        <button type="button">Danach</button>
      </>,
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: topics[0]!.name })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("option", { name: topics[1]!.name })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{End}");
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(`${topics[1]!.name} entfernen`)).toHaveFocus();
  });

  it("supports typeahead without enabling Collection-only paging or Alt+ArrowUp confirmation", async () => {
    const user = userEvent.setup();
    render(<TopicSelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Themen" });

    trigger.focus();
    await user.keyboard("t");
    expect(screen.getByRole("option", { name: "Tiere" })).toHaveAttribute("data-active", "true");
    await user.keyboard("{PageDown}{Alt>}{ArrowUp}{/Alt}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByLabelText("Tiere entfernen")).not.toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByLabelText("Tiere entfernen")).toBeVisible();
  });

  it("disables both the trigger and selected chip removal", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TopicSelect
        id="topics"
        topics={topics}
        value={[topics[0]!.id]}
        onChange={onChange}
        disabled
      />,
    );
    const remove = screen.getByLabelText(`${topics[0]!.name} entfernen`);

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(remove).toBeDisabled();
    await user.click(remove);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers Thema erstellen when there are no Topics", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <>
        <label htmlFor="topics">Themen</label>
        <TopicSelect
          id="topics"
          topics={[]}
          value={[]}
          onChange={() => undefined}
          onCreate={onCreate}
        />
      </>,
    );
    const combobox = screen.getByRole("combobox", { name: "Themen" });

    expect(combobox).toBeEnabled();
    await user.click(combobox);
    const createOption = screen.getByRole("option", { name: "Thema erstellen" });
    expect(createOption.querySelector("svg")).not.toBeNull();
    expect(createOption.querySelector("[aria-hidden='true']")).not.toBeNull();
    await user.click(createOption);

    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
