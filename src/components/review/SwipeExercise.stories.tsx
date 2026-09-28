import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { card, tutorExercise } from "../../storybook/fixtures";
import { SwipeExercise } from "./SwipeExercise";
const meta = {
  title: "Screens/Review/Swipe",
  component: SwipeExercise,
  parameters: { layout: "fullscreen" },
  args: {
    view: {
      kind: "swipe",
      currentCard: card,
      options: [
        { cardId: card.id, text: "Hallo", correct: true },
        { cardId: "other", text: "Danke", correct: false },
      ],
      position: 4,
      total: 8,
      resolved: false,
      correct: false,
      issue: undefined,
      issueRequestId: undefined,
      tutorConversation: [],
      tutorExercise,
    },
    issueKey: undefined,
    tutorOpen: false,
    tutorDisabled: false,
    frontLanguage: "vi-VN",
    backLanguage: "de-DE",
    onClose: fn(),
    onChoose: fn(),
    onAdvance: fn(),
    onOpenTutor: fn(),
    onCloseTutor: fn(),
  },
} satisfies Meta<typeof SwipeExercise>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Question: Story = {};
export const Correct: Story = {
  args: { view: { ...meta.args.view, resolved: true, correct: true } },
};
export const Wrong: Story = {
  args: { view: { ...meta.args.view, resolved: true, correct: false } },
};
export const Interactive: Story = {
  render: function Example(args) {
    const [view, setView] = useState(args.view);

    return (
      <SwipeExercise
        {...args}
        view={view}
        onChoose={(id) => setView({ ...view, resolved: true, correct: id === card.id })}
      />
    );
  },
};
