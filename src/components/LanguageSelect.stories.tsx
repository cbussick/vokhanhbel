import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn, userEvent, within } from "storybook/test";
import { LanguageSelect } from "./LanguageSelect";
import styles from "../storybook/Foundations.module.css";
const meta = {
  title: "Components/LanguageSelect",
  component: LanguageSelect,
  tags: ["autodocs"],
  args: { id: "language", value: null, onChange: fn() },
  render: function Example(args) {
    const [value, setValue] = useState(args.value);

    return (
      <div className={styles.field}>
        <label htmlFor={args.id}>Sprache der Vorderseite</label>
        <LanguageSelect
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
} satisfies Meta<typeof LanguageSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unset: Story = {};
export const Vietnamese: Story = { args: { value: "vi-VN" } };
export const German: Story = { args: { value: "de-DE" } };
export const English: Story = { args: { value: "en-US" } };
export const UnknownLocalePreserved: Story = { args: { value: "fr-CA" } };
export const Disabled: Story = { args: { disabled: true, value: "vi-VN" } };
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox"));
  },
};
export const Popover: Story = { ...Open, args: { escapeClipping: true } };
