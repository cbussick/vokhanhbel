import type { Meta, StoryObj } from "@storybook/react-vite";
import { audio } from "../../storybook/fixtures";
import { CardFace } from "./CardFace";
const meta = {
  title: "Components/Cards/CardFace",
  component: CardFace,
  tags: ["autodocs"],
  args: { label: "front", face: { text: "xin chào", audio: null }, language: "vi-VN" },
} satisfies Meta<typeof CardFace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Text: Story = {};
export const TextAndClip: Story = { args: { face: { text: "xin chào", audio } } };
export const ClipOnly: Story = { args: { face: { text: null, audio } } };
export const CompactTextAndClip: Story = {
  args: { compact: true, face: { text: "xin chào", audio } },
};
export const LongText: Story = {
  args: { face: { text: "Cảm ơn bạn rất nhiều! ".repeat(30), audio } },
};
export const GermanBack: Story = {
  args: { label: "back", language: "de-DE", face: { text: "Schöne Grüße!", audio: null } },
};
