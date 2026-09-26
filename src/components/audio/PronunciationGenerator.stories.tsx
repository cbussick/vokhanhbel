import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { failedMutation, handlers, pendingRequest } from "../../storybook/handlers";
import { PronunciationGenerator } from "./PronunciationGenerator";
const meta = {
  title: "Components/Audio/PronunciationGenerator",
  component: PronunciationGenerator,
  tags: ["autodocs"],
  args: { face: "front", language: "vi-VN", faceText: "xin chào", onGenerated: fn() },
} satisfies Meta<typeof PronunciationGenerator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const EmptyText: Story = { args: { faceText: "" } };
export const TooLong: Story = { args: { faceText: "xin chào ".repeat(300) } };
const generate: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
};
export const Generating: Story = {
  parameters: { msw: { handlers: { app: [pendingRequest, ...handlers] } } },
  play: generate,
};
export const Failed: Story = {
  parameters: { msw: { handlers: { app: [failedMutation, ...handlers] } } },
  play: generate,
};
export const Generated: Story = { play: generate };
