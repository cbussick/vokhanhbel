import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { collection } from "../storybook/fixtures";
import { saving, saveFailed } from "../storybook/formStates";
import { offline } from "../storybook/offline";
import { CollectionFormDialog } from "./CollectionFormDialog";
const meta = {
  title: "Components/CollectionFormDialog",
  component: CollectionFormDialog,
  parameters: { layout: "fullscreen" },
  args: { onClose: fn(), onCreated: fn(), onDeleted: fn() },
} satisfies Meta<typeof CollectionFormDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
const save: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: "Speichern" }));
};
export const Create: Story = {};
export const Saving: Story = { args: { collection }, parameters: saving, play: save };
export const SaveFailed: Story = { args: { collection }, parameters: saveFailed, play: save };
export const Offline: Story = { args: { collection }, beforeEach: offline };
export const Edit: Story = { args: { collection, cardCount: 24 } };
export const UndeclaredLanguages: Story = {
  args: { collection: { ...collection, frontLanguage: null, backLanguage: null } },
};
export const UnknownLanguage: Story = {
  args: { collection: { ...collection, frontLanguage: "fr-CA" } },
};
export const DeleteConfirmation: Story = {
  ...Edit,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Sammlung löschen" }),
    );
  },
};
