import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { collection, topic } from "../storybook/fixtures";
import { saving, saveFailed } from "../storybook/formStates";
import { offline } from "../storybook/offline";
import { TopicFormDialog } from "./TopicFormDialog";
const meta = {
  title: "Components/TopicFormDialog",
  component: TopicFormDialog,
  parameters: { layout: "fullscreen" },
  args: { collectionId: collection.id, onClose: fn(), onCreated: fn(), onDeleted: fn() },
} satisfies Meta<typeof TopicFormDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
const save: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: "Speichern" }));
};
export const Create: Story = {};
export const Saving: Story = { args: { topic }, parameters: saving, play: save };
export const SaveFailed: Story = { args: { topic }, parameters: saveFailed, play: save };
export const Offline: Story = { args: { topic }, beforeEach: offline };
export const Edit: Story = { args: { topic } };
export const LongName: Story = {
  args: { topic: { ...topic, name: "Begrüßungen und Unterhaltungen mit Freunden" } },
};
export const DeleteConfirmation: Story = {
  ...Edit,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Thema löschen" }),
    );
  },
};
