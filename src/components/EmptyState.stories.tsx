import type { Meta, StoryObj } from "@storybook/react-vite";
import { AddIcon } from "./AddIcon";
import { EmptyCardsIcon, EmptyCollectionsIcon } from "./EmptyCardsIcon";
import { EmptyState } from "./EmptyState";
import { IconButton } from "./IconButton";
const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: { text: "Hier sind noch keine Karten.", icon: <EmptyCardsIcon /> },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Cards: Story = {};
export const Collections: Story = {
  args: { text: "Erstelle deine erste Sammlung.", icon: <EmptyCollectionsIcon /> },
};
export const WithAction: Story = {
  args: { action: <IconButton icon={<AddIcon />}>Karte hinzufügen</IconButton> },
};
export const TextOnly: Story = {
  args: { icon: undefined, text: "Für heute ist alles geschafft. Komm morgen wieder!" },
};
export const LongText: Story = {
  args: {
    text: "In dieser Sammlung gibt es noch keine Karten zu diesem Thema. Füge eine Karte mit Text, einem Clip oder beidem hinzu, um mit dem Lernen zu beginnen.",
  },
};
