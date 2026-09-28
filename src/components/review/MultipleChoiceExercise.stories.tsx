import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { card, options, tutorExercise } from "../../storybook/fixtures";
import { MultipleChoiceExercise } from "./MultipleChoiceExercise";
const meta = {
  title: "Screens/Review/Multiple choice",
  component: MultipleChoiceExercise,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "View snapshots of the real Exercise screen. For interactive answer selection use Components/Review/MultipleChoiceOptions/Interactive.",
      },
    },
  },
  args: {
    view: {
      kind: "multipleChoice",
      currentCard: card,
      position: 2,
      total: 8,
      options,
      resolved: false,
      correct: false,
      issue: undefined,
      issueRequestId: undefined,
      tutorConversation: [],
      tutorExercise,
    },
    issueKey: undefined,
    frontAudioAvailable: true,
    unavailableOptionIds: new Set<string>(),
    tutorOpen: false,
    tutorDisabled: false,
    frontLanguage: "vi-VN",
    backLanguage: "de-DE",
    onClose: fn(),
    onAdvance: fn(),
    onSkip: fn(),
    onFrontAudioAvailabilityChange: fn(),
    onOptionAvailabilityChange: fn(),
    onOpenTutor: fn(),
    onCloseTutor: fn(),
  },
} satisfies Meta<typeof MultipleChoiceExercise>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Question: Story = {};
export const Correct: Story = {
  args: {
    view: {
      ...meta.args.view,
      resolved: true,
      correct: true,
      options: options.map((option, index) => ({ ...option, revealedCorrect: index === 0 })),
    },
  },
};
export const Wrong: Story = {
  args: {
    view: {
      ...meta.args.view,
      resolved: true,
      correct: false,
      options: options.map((option, index) => ({
        ...option,
        dead: index !== 0,
        revealedCorrect: index === 0,
      })),
    },
  },
};
