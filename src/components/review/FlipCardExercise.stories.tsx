import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { audio, card, tutorExercise } from "../../storybook/fixtures";
import { FlipCardExercise } from "./FlipCardExercise";
const meta = {
  title: "Screens/Review/Flip Card",
  component: FlipCardExercise,
  parameters: { layout: "fullscreen" },
  args: {
    view: {
      kind: "flip",
      currentCard: card,
      position: 1,
      total: 8,
      revealed: false,
      issue: undefined,
      issueRequestId: undefined,
      tutorConversation: [],
      tutorExercise,
    },
    issueKey: undefined,
    revealComplete: true,
    frontAudioAvailable: true,
    backAudioAvailable: true,
    tutorOpen: false,
    tutorDisabled: false,
    frontLanguage: "vi-VN",
    backLanguage: "de-DE",
    onClose: fn(),
    onReveal: fn(),
    onGrade: fn(),
    onSkip: fn(),
    onFrontAudioAvailabilityChange: fn(),
    onBackAudioAvailabilityChange: fn(),
    onOpenTutor: fn(),
    onCloseTutor: fn(),
  },
} satisfies Meta<typeof FlipCardExercise>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Front: Story = {};
export const Revealed: Story = { args: { view: { ...meta.args.view, revealed: true } } };
export const AudioUnavailable: Story = {
  args: {
    frontAudioAvailable: false,
    view: { ...meta.args.view, currentCard: { ...card, front: { text: null, audio } } },
  },
};
export const LongText: Story = {
  args: {
    view: {
      ...meta.args.view,
      currentCard: {
        ...card,
        front: { text: "Xin chào! Cảm ơn bạn rất nhiều. ".repeat(25), audio: null },
      },
    },
  },
};
export const InteractiveReveal: Story = {
  render: function Example(args) {
    const [revealed, setRevealed] = useState(false);

    return (
      <FlipCardExercise
        {...args}
        view={{ ...args.view, revealed }}
        onReveal={() => setRevealed(true)}
      />
    );
  },
};
