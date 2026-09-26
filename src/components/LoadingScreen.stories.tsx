import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingScreen } from "./LoadingScreen";
const meta = {
  title: "Components/LoadingScreen",
  component: LoadingScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LoadingScreen>;
export default meta;
export const Loading: StoryObj<typeof meta> = {};
