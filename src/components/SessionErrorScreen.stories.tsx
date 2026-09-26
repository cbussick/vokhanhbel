import type { Meta, StoryObj } from "@storybook/react-vite";
import { SessionErrorScreen } from "./SessionErrorScreen";
const meta = {
  title: "Screens/Session error",
  component: SessionErrorScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SessionErrorScreen>;
export default meta;
export const Retry: StoryObj<typeof meta> = {};
