import type { Meta, StoryObj } from "@storybook/react-vite";
import { TutopherAvatar } from "./TutopherAvatar";
const meta = {
  title: "Components/TutopherAvatar",
  component: TutopherAvatar,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TutopherAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Medium: Story = {};
export const Small: Story = { args: { size: "small" } };
export const Large: Story = { args: { size: "large" } };
