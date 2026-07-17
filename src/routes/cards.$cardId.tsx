import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { RequireSession } from "../components/RequireSession";
import { CardsScreen } from "./cards";

export const Route = createFileRoute("/cards/$cardId")({ component: CardDetailRoute });
function CardDetailRoute() {
  const { t } = useTranslation();
  const { cardId } = Route.useParams();

  return (
    <RequireSession>
      <AppShell title={t("cards.title")}>
        <CardsScreen selectedId={cardId} />
      </AppShell>
    </RequireSession>
  );
}
