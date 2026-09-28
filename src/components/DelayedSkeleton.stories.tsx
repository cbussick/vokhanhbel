import type { Meta, StoryObj } from "@storybook/react-vite";
import { DelayedSkeleton } from "./DelayedSkeleton";
const meta = { title: "Components/DelayedSkeleton", component: DelayedSkeleton } satisfies Meta<
  typeof DelayedSkeleton
>;
export default meta;
export const AfterDelay: StoryObj<typeof meta> = {
  parameters: {
    docs: {
      description: {
        story:
          "Initially hidden; the real component reveals its skeleton after its built-in delay. Replay to inspect the transition.",
      },
    },
  },
};
