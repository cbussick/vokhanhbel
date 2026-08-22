import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "../i18n/config";
import { topicListSchema } from "../contracts/topic";
import { testTopics } from "../test/server";
import { TopicSelect } from "./TopicSelect";

const topics = topicListSchema.parse(testTopics);

function TopicSelectHarness() {
  const [value, setValue] = useState<string[]>([]);

  return (
    <>
      <label htmlFor="topics">Themen</label>
      <TopicSelect id="topics" topics={topics} value={value} onChange={setValue} />
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

    expect(screen.getByRole("option", { name: "Tiere" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Tiere entfernen")).toBeVisible();
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
