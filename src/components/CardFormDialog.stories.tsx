import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { audio, card, collection, generatedAudio } from "../storybook/fixtures";
import { saving, saveFailed } from "../storybook/formStates";
import { offline } from "../storybook/offline";
import { CardFormDialog } from "./CardFormDialog";
const meta = {
  title: "Components/CardFormDialog",
  component: CardFormDialog,
  parameters: { layout: "fullscreen" },
  args: { onClose: fn(), defaultCollectionId: collection.id },
} satisfies Meta<typeof CardFormDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
const save: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: "Speichern" }));
};
export const Create: Story = {};
export const Saving: Story = { args: { card }, parameters: saving, play: save };
export const SaveFailed: Story = { args: { card }, parameters: saveFailed, play: save };
export const Offline: Story = { args: { card }, beforeEach: offline };
export const Edit: Story = { args: { card } };
export const RecordedClip: Story = {
  args: { card: { ...card, front: { text: card.front.text, audio } } },
};
export const GeneratedClip: Story = {
  args: { card: { ...card, front: { text: card.front.text, audio: generatedAudio } } },
};
export const AudioOnly: Story = { args: { card: { ...card, front: { text: null, audio } } } };
export const LongText: Story = {
  args: {
    card: { ...card, front: { text: "Xin chào! Cảm ơn bạn rất nhiều. ".repeat(20), audio: null } },
  },
};
export const DeleteConfirmation: Story = {
  ...Edit,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Karte löschen" }),
    );
  },
};
