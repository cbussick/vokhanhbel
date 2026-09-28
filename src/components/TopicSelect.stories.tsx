import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn, userEvent, within } from "storybook/test";
import { topics } from "../storybook/fixtures";
import { TopicSelect } from "./TopicSelect";
import styles from "../storybook/Foundations.module.css";
const meta = {
  title: "Components/TopicSelect",
  component: TopicSelect,
  tags: ["autodocs"],
  args: { id: "topics", topics, value: [], onChange: fn() },
  render: function Example(args) {
    const [value, setValue] = useState(args.value);

    return (
      <div className={styles.field}>
        <label htmlFor={args.id}>Themen</label>
        <TopicSelect
          {...args}
          value={value}
          onChange={(next) => {
            setValue(next);
            args.onChange(next);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof TopicSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoneSelected: Story = {};
export const MultipleSelected: Story = { args: { value: topics.map((topic) => topic.id) } };
export const Disabled: Story = { args: { disabled: true, value: [topics[0]!.id] } };
export const Empty: Story = { args: { topics: [] } };
export const WithCreateAction: Story = { args: { onCreate: fn() } };
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox"));
  },
};
