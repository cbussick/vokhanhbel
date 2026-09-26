import type { Meta, StoryObj } from "@storybook/react-vite";
import { AddIcon } from "./AddIcon";
import { AppShell } from "./AppShell";
import { CollectionIcon } from "./CollectionIcon";
import { EmptyState } from "./EmptyState";
import { IconButton } from "./IconButton";
const meta = {
  title: "Screens/App shell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: { title: "Karten", children: <EmptyState text="Hier erscheinen deine Karten." /> },
} satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Standard: Story = {};
export const Focused: Story = { args: { title: "Lernen", variant: "focused" } };
export const WithContextAndAction: Story = {
  args: {
    title: "Vietnamesisch",
    titleIcon: <CollectionIcon icon="flag-vn" />,
    titleContext: <p>Sammlungen</p>,
    titleAction: <IconButton icon={<AddIcon />}>Karte hinzufügen</IconButton>,
  },
};
export const LongTitle: Story = {
  args: { title: "Vietnamesisch für Unterhaltungen mit Familie und Freunden" },
};
