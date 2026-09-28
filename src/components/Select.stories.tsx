import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { collectionLanguages } from "../contracts/collection";
import { i18n } from "../i18n/config";
import { collections } from "../storybook/fixtures";
import { AddIcon } from "./AddIcon";
import { CollectionIcon } from "./CollectionIcon";
import { Select, type SelectOption } from "./Select";
import styles from "../storybook/Foundations.module.css";

type SingleSelectProps = Extract<
  ComponentProps<typeof Select<string | null>>,
  { multiple?: false }
>;
const languageOptions: SelectOption<string | null>[] = [
  { value: null, label: i18n.t("collections.noLanguage") },
  ...collectionLanguages.map((value) => ({
    value,
    label: i18n.t(`collections.languages.${value}`),
  })),
];
const collectionOptions = collections.map((collection) => ({
  value: collection.id,
  label: collection.name,
  icon: <CollectionIcon icon={collection.icon} size="compact" />,
}));

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The shared control used by LanguageSelect, CollectionSelect and TopicSelect in the app. These examples use the app's labels and icons. Multiple selection and removable chips are shown in Components/TopicSelect; domain creation flows remain in the form-dialog stories. No separate Storybook control or styling is used.",
      },
    },
  },
  args: {
    id: "select",
    options: languageOptions,
    value: "vi-VN",
    onChange: fn(),
    keyboard: "basic",
  },
  render: function Example(args) {
    const [value, setValue] = useState(args.value);

    return (
      <div className={styles.field}>
        <label htmlFor={args.id}>Auswahl</label>
        <Select
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
} satisfies Meta<SingleSelectProps>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TextOnly: Story = {};
export const NullOption: Story = { args: { value: null } };
export const WithIcons: Story = {
  args: { options: collectionOptions, value: collections[0]!.id, keyboard: "extended" },
};
export const Unselected: Story = { args: { ...WithIcons.args, value: "" } };
export const Disabled: Story = { args: { disabled: true } };
export const DisabledWithIcon: Story = { args: { ...WithIcons.args, disabled: true } };
export const Empty: Story = { args: { options: [], value: "" } };
export const WithCreateAction: Story = {
  args: {
    ...WithIcons.args,
    action: { label: i18n.t("collections.create"), icon: <AddIcon />, onSelect: fn() },
  },
};
export const OpenTextOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox"));
    await expect(canvas.getByRole("listbox")).toBeVisible();
  },
};
export const OpenWithIcons: Story = { ...OpenTextOnly, args: { ...WithCreateAction.args } };
export const KeyboardSelection: Story = {
  args: { ...WithIcons.args },
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole("combobox");
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith(collectionOptions[1]!.value);
    await expect(trigger).toHaveTextContent(collectionOptions[1]!.label);
  },
};
