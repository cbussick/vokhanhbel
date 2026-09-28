import type { Preview } from "@storybook/react-vite";
import { initialize, mswLoader } from "msw-storybook-addon";
import "../src/styles/fonts.css";
import "../src/styles/global.css";
import "../src/i18n/config";
import { handlers } from "../src/storybook/handlers";
import { Providers } from "../src/storybook/Providers";

// v2 addon API: https://storybook.js.org/docs/9/writing-stories/mocking-data-and-modules/mocking-network-requests
initialize({ onUnhandledRequest: "bypass" });
const preview: Preview = {
  loaders: [mswLoader],
  decorators: [
    (Story, context) => (
      <Providers key={context.id} authenticated={context.parameters.authenticated !== false}>
        <Story />
      </Providers>
    ),
  ],
  parameters: {
    msw: { handlers: { app: handlers } },
    controls: { expanded: true },
    // App fields use fixed IDs and state stories own browser/network state. Keep Docs examples
    // isolated too; interactive controls remain available in Canvas.
    docs: { story: { inline: false, height: "400px" } },
    a11y: { test: "todo" }, // Existing issues are reported, not silently redesigned in VOK-32.
    layout: "padded",
    options: {
      storySort: {
        order: [
          "Foundations",
          ["Overview", "Colors", "Spacing", "Radii", "Typography", "Audit"],
          "Components",
          "Patterns",
          "Screens",
        ],
      },
    },
  },
  beforeEach() {
    document.documentElement.lang = "de";
  },
};
export default preview;
