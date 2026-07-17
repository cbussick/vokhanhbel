import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { CardFormDialog } from "../components/CardFormDialog";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { RequireSession } from "../components/RequireSession";
import { cardsQuery } from "../lib/queries";
import { useOnlineStatus } from "../lib/browserState";
import styles from "./cards.module.css";

export const Route = createFileRoute("/cards")({ component: CardsRoute });

export function CardsScreen({ selectedId }: { selectedId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cards = useQuery(cardsQuery);
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("de");
  const visible = normalizedQuery
    ? (cards.data ?? []).filter(
        (card) =>
          card.front.toLocaleLowerCase("de").includes(normalizedQuery) ||
          card.back.toLocaleLowerCase("de").includes(normalizedQuery),
      )
    : (cards.data ?? []);
  const selected = cards.data?.find((card) => card.id === selectedId);

  if (cards.isPending) return <DelayedSkeleton />;
  if (cards.isError && !cards.data)
    return (
      <div className={styles.center}>
        <p>{t("errors.load")}</p>
        <button type="button" onClick={() => void cards.refetch()}>
          {t("common.retry")}
        </button>
      </div>
    );

  return (
    <>
      <div className={styles.toolbar}>
        <label htmlFor="card-search">{t("cards.search")}</label>
        <input
          id="card-search"
          type="search"
          placeholder={t("cards.searchHint")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" onClick={() => setCreating(true)} disabled={!online}>
          {t("cards.add")}
        </button>
        {!online && <p>{t("cards.offline")}</p>}
      </div>
      {cards.isError && cards.data && (
        <p role="status" className={styles.warning}>
          {t("errors.stale")}
        </p>
      )}
      {(cards.data?.length ?? 0) === 0 ? (
        <div className={styles.center}>
          <p>{t("cards.empty")}</p>
          <button type="button" onClick={() => setCreating(true)}>
            {t("cards.add")}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.center}>
          <p>{t("cards.noResults", { query: query.trim() })}</p>
          <button type="button" onClick={() => setQuery("")}>
            {t("cards.resetSearch")}
          </button>
        </div>
      ) : (
        <ul className={styles.list}>
          {visible.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => void navigate({ to: "/cards/$cardId", params: { cardId: card.id } })}
              >
                <strong>{card.front}</strong>
                <span>{card.back}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {creating && <CardFormDialog onClose={() => setCreating(false)} />}
      {selected && (
        <CardFormDialog
          card={selected}
          onClose={() => void navigate({ to: "/cards" })}
          onDeleted={() => void navigate({ to: "/cards" })}
        />
      )}
    </>
  );
}

function CardsRoute() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    document.title = `${t("cards.title")} | ${t("appName")}`;
  }, [t]);

  if (pathname.startsWith("/cards/")) return <Outlet />;

  return (
    <RequireSession>
      <AppShell title={t("cards.title")}>
        <CardsScreen />
      </AppShell>
    </RequireSession>
  );
}
