import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { collection, topics } from "../../storybook/fixtures";
import { SessionSummary } from "./SessionSummary";
const meta = {
  title: "Screens/Review/Session summary",
  component: SessionSummary,
  parameters: { layout: "fullscreen" },
  args: {
    view: {
      kind: "summary",
      scope: { kind: "all" },
      cumulativeReviewSubmissions: 8,
      cumulativeOptimisticPoints: 65,
      firstRound: false,
      canRepeatForgotten: false,
    },
    currentStreak: 3,
    onRepeatForgotten: fn(),
    onFinish: fn(),
  },
} satisfies Meta<typeof SessionSummary>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const Celebration: Story = { args: { view: { ...meta.args.view, firstRound: true } } };
export const RepeatForgotten: Story = {
  args: { view: { ...meta.args.view, canRepeatForgotten: true } },
};
export const CollectionScope: Story = {
  args: { view: { ...meta.args.view, scope: { kind: "collection", collection, topics: [] } } },
};
export const TopicScope: Story = {
  args: { view: { ...meta.args.view, scope: { kind: "collection", collection, topics } } },
};
