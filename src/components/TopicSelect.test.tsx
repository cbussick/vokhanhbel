import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
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
});
