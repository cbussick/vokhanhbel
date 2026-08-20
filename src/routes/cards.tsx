import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireSession } from "../components/RequireSession";

export const Route = createFileRoute("/cards")({ component: CardsLayoutRoute });

function CardsLayoutRoute() {
  return (
    <RequireSession>
      <Outlet />
    </RequireSession>
  );
}
