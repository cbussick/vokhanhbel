import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AddIcon } from "./AddIcon";
import { IconButton } from "./IconButton";
const meta = {
  title: "Components/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: { children: "Karte hinzufügen", icon: <AddIcon />, onClick: fn() },
  argTypes: {
    icon: { control: false },
    variant: { control: "inline-radio", options: ["primary", "secondary"] },
    size: { control: "inline-radio", options: ["regular", "compact"] },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Compact: Story = { args: { size: "compact" } };
export const CompactSecondary: Story = { args: { size: "compact", variant: "secondary" } };
export const Disabled: Story = { args: { disabled: true } };
export const SecondaryDisabled: Story = { args: { disabled: true, variant: "secondary" } };
export const Hover: Story = { globals: { pseudo: { hover: true } } };
export const Pressed: Story = { globals: { pseudo: { active: true } } };
export const FocusVisible: Story = { globals: { pseudo: { focusVisible: true } } };
export const LongLabel: Story = {
  args: { children: "Eine neue Karte zur Sammlung Vietnamesisch hinzufügen" },
};
