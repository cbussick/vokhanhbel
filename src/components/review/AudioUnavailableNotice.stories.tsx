import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AudioUnavailableNotice } from "./AudioUnavailableNotice";
const meta = {
  title: "Components/Review/AudioUnavailableNotice",
  component: AudioUnavailableNotice,
  args: { onSkip: fn() },
} satisfies Meta<typeof AudioUnavailableNotice>;
export default meta;
export const Unavailable: StoryObj<typeof meta> = {};
