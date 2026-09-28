import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TutorButton } from "./TutorButton";
const meta = {
  title: "Components/Review/TutorButton",
  component: TutorButton,
  args: { onClick: fn(), disabled: false },
} satisfies Meta<typeof TutorButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Available: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const FocusVisible: Story = { globals: { pseudo: { focusVisible: true } } };
