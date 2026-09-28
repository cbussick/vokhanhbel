import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent } from "storybook/test";
import { audio } from "../../storybook/fixtures";
import { AudioPlayer } from "./AudioPlayer";
const meta = {
  title: "Components/Audio/AudioPlayer",
  component: AudioPlayer,
  tags: ["autodocs"],
  args: { audio, label: "Vorderseite", source: "/storybook-tone.wav" },
  parameters: {
    docs: {
      description: {
        component:
          "Playback uses a locally generated quiet test tone, not a real pronunciation or external service. State stories dispatch media events to the real audio element for deterministic inspection without autoplay.",
      },
    },
  },
} satisfies Meta<typeof AudioPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Compact: Story = { args: { compact: true } };
export const Playing: Story = {
  play: async ({ canvasElement }) => {
    await fireEvent.playing(canvasElement.querySelector("audio")!);
  },
};
export const Paused: Story = {
  play: async ({ canvasElement }) => {
    await fireEvent.pause(canvasElement.querySelector("audio")!);
  },
};
export const Ended: Story = {
  play: async ({ canvasElement }) => {
    await fireEvent.ended(canvasElement.querySelector("audio")!);
  },
};
export const Unavailable: Story = {
  play: async ({ canvasElement }) => {
    await fireEvent.error(canvasElement.querySelector("audio")!);
  },
};
export const MaximumDuration: Story = { args: { audio: { ...audio, durationMs: 7000 } } };
