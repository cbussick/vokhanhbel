import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ResolutionFooter } from "./ResolutionFooter";
const meta = {
  title: "Components/Review/ResolutionFooter",
  component: ResolutionFooter,
  args: {
    resolved: true,
    verdict: "Richtig!",
    onAdvance: fn(),
    tutor: { onOpen: fn(), disabled: false },
  },
} satisfies Meta<typeof ResolutionFooter>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Correct: Story = {};
export const Wrong: Story = { args: { verdict: "Leider falsch." } };
export const Unresolved: Story = { args: { resolved: false } };
export const TutorUnavailable: Story = { args: { tutor: { onOpen: fn(), disabled: true } } };
export const WithoutTutor: Story = {
  render: ({ resolved, verdict, onAdvance }) => (
    <ResolutionFooter resolved={resolved} verdict={verdict} onAdvance={onAdvance} />
  ),
};
