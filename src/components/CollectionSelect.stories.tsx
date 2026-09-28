import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { collection, collections } from "../storybook/fixtures";
import { CollectionSelect } from "./CollectionSelect";
import styles from "../storybook/Foundations.module.css";
const meta = {
  title: "Components/CollectionSelect",
  component: CollectionSelect,
  tags: ["autodocs"],
  args: { id: "collection", collections, value: "", onChange: fn() },
  render: function Example(args) {
    const [value, setValue] = useState(args.value);

    return (
      <div className={styles.field}>
        <label htmlFor={args.id}>Sammlung</label>
        <CollectionSelect
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
} satisfies Meta<typeof CollectionSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Placeholder: Story = {};
export const Selected: Story = { args: { value: collection.id } };
export const Disabled: Story = { args: { disabled: true, value: collection.id } };
export const Empty: Story = { args: { collections: [] } };
export const WithCreateAction: Story = { args: { onCreate: fn() } };
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox"));
    await expect(canvas.getByRole("listbox")).toBeVisible();
  },
};
export const KeyboardSelection: Story = {
  play: async ({ canvasElement, args }) => {
    const control = within(canvasElement).getByRole("combobox");
    control.focus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onChange).toHaveBeenCalled();
  },
};
export const LongName: Story = {
  args: {
    collections: [
      { ...collection, name: "Vietnamesisch – Alltag, Familie und lange Gespräche unterwegs" },
    ],
    value: collection.id,
  },
};
