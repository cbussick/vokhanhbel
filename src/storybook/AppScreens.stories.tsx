import type { Meta, StoryObj } from "@storybook/react-vite";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { routeTree } from "../routeTree.gen";
import { card, collection } from "./fixtures";
import { handlers } from "./handlers";
function Screen({ path }: { path: string }) {
  const [router] = useState(() =>
    createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) }),
  );

  return <RouterProvider router={router} />;
}
const meta = {
  title: "Screens/App pages",
  component: Screen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Real routed pages with fictional API data. Includes route-local Collection tiles, Card rows, Topic chips, progress and statistics that are not exported components. No backend is contacted.",
      },
    },
  },
  args: { path: "/cards" },
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Login: Story = {
  args: { path: "/login" },
  parameters: {
    authenticated: false,
    msw: {
      handlers: {
        app: [
          http.get("/api/session", () => HttpResponse.json({ authenticated: false })),
          ...handlers,
        ],
      },
    },
  },
};
export const Collections: Story = {};
export const CardList: Story = { args: { path: `/cards/${collection.id}` } };
export const CardDetail: Story = { args: { path: `/cards/${collection.id}/${card.id}` } };
export const ReviewOverview: Story = { args: { path: "/review" } };
export const PointsAndStatistics: Story = { args: { path: "/me" } };
export const EmptyCardList: Story = {
  args: { path: `/cards/${collection.id}` },
  parameters: {
    msw: { handlers: { app: [http.get("/api/cards", () => HttpResponse.json([])), ...handlers] } },
  },
};
