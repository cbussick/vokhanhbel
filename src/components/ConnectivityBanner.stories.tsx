import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { useEffect, useRef } from "react";
import { useReviewSubmissions } from "../state/ReviewSubmissionContext";
import { card, timestamp } from "../storybook/fixtures";
import { handlers } from "../storybook/handlers";
import { offline } from "../storybook/offline";
import { ConnectivityBanner } from "./ConnectivityBanner";
function PendingBanner() {
  const { enqueueSubmission } = useReviewSubmissions();
  const queued = useRef(false);
  useEffect(() => {
    if (queued.current) return;
    queued.current = true;
    enqueueSubmission(
      {
        input: {
          id: "99999999-9999-4999-8999-999999999999",
          cardId: card.id,
          grade: "knew_it",
          reviewedAt: timestamp,
        },
        reviewSessionId: "storybook",
        card,
        optimisticPoints: 10,
        exerciseIndex: 0,
      },
      () => {},
    );
  }, [enqueueSubmission]);

  return <ConnectivityBanner />;
}
const meta = {
  title: "Components/ConnectivityBanner",
  component: ConnectivityBanner,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConnectivityBanner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Online: Story = {
  parameters: {
    docs: {
      description: {
        story: "Intentionally renders nothing when online with no outstanding Review Submissions.",
      },
    },
  },
};
export const Offline: Story = { beforeEach: offline };
export const OfflinePending: Story = { beforeEach: offline, render: () => <PendingBanner /> };
export const Syncing: Story = {
  render: () => <PendingBanner />,
  parameters: {
    msw: {
      handlers: {
        app: [
          http.post("/api/reviews", async () => {
            await delay("infinite");
          }),
          ...handlers,
        ],
      },
    },
  },
};
export const Failed: Story = {
  render: () => <PendingBanner />,
  parameters: {
    msw: {
      handlers: {
        app: [
          http.post("/api/reviews", () =>
            HttpResponse.json(
              { type: "about:blank", title: "Unavailable", status: 503 },
              { status: 503 },
            ),
          ),
          ...handlers,
        ],
      },
    },
  },
};
