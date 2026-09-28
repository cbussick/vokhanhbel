import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ErrorScreen } from "./ErrorScreen";
const meta = {
  title: "Components/ErrorScreen",
  component: ErrorScreen,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    title: "Das hat nicht geklappt",
    message: "Bitte versuche es noch einmal.",
    actionLabel: "Erneut versuchen",
    onAction: fn(),
  },
} satisfies Meta<typeof ErrorScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Retry: Story = {};
export const WithErrorId: Story = {
  args: {
    message: "Die Verbindung konnte nicht hergestellt werden. Fehler-ID: storybook-example-32",
  },
};
export const LongMessage: Story = {
  args: {
    title: "Die Sitzung konnte nicht überprüft werden",
    message:
      "Deine Karten konnten gerade nicht geladen werden. Prüfe deine Internetverbindung und versuche es anschließend erneut. Deine gespeicherten Karten bleiben erhalten.",
  },
};
