import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { cards, tutorExercise } from "../../storybook/fixtures";
import { MatchingExercise } from "./MatchingExercise";
const front = cards.map((card) => ({ cardId: card.id, text: card.front.text!, matched: false }));
const back = [...cards]
  .reverse()
  .map((card) => ({ cardId: card.id, text: card.back.text!, matched: false }));
const meta = {
  title: "Screens/Review/Matching",
  component: MatchingExercise,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "View snapshots; selection and mismatch feedback are local and interactive, but matching does not advance this fixed view fixture.",
      },
    },
  },
  args: {
    view: {
      kind: "matching",
      cards,
      front,
      back,
      position: 3,
      total: 8,
      resolved: false,
      issue: undefined,
      issueRequestId: undefined,
      tutorConversation: [],
      tutorExercise,
    },
    issueKey: undefined,
    online: true,
    tutorOpen: false,
    tutorCard: undefined,
    frontLanguage: "vi-VN",
    backLanguage: "de-DE",
    onClose: fn(),
    onAdvance: fn(),
    onOpenTutor: fn(),
    onCloseTutor: fn(),
  },
} satisfies Meta<typeof MatchingExercise>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Question: Story = {};
export const PartlyMatched: Story = {
  args: {
    view: {
      ...meta.args.view,
      front: front.map((entry, index) => ({ ...entry, matched: index === 0 })),
      back: back.map((entry) => ({ ...entry, matched: entry.cardId === cards[0]!.id })),
    },
  },
};
export const Resolved: Story = {
  args: {
    view: {
      ...meta.args.view,
      resolved: true,
      front: front.map((entry) => ({ ...entry, matched: true })),
      back: back.map((entry) => ({ ...entry, matched: true })),
    },
  },
};
export const ResolvedOffline: Story = { args: { ...Resolved.args, online: false } };
