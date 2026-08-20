import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AppShell } from "../components/AppShell";
import { CardFormDialog } from "../components/CardFormDialog";
import { CollectionManagerDialog } from "../components/CollectionManagerDialog";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { RequireSession } from "../components/RequireSession";
import type { Card } from "../contracts/card";
import { uuidSchema } from "../contracts/common";
import { cardsQuery, collectionsQuery } from "../lib/queries";
import { useOnlineStatus } from "../lib/browserState";
import styles from "./cards.module.css";

const cardsSearchSchema = z.object({ collection: uuidSchema.optional().catch(undefined) });

export const Route = createFileRoute("/cards")({
  component: CardsRoute,
  validateSearch: cardsSearchSchema,
});

function countCardsByCollection(cards: Card[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const card of cards) counts.set(card.collectionId, (counts.get(card.collectionId) ?? 0) + 1);

  return counts;
}

export function CardsScreen({ selectedId }: { selectedId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { collection: collectionFilter } = Route.useSearch();
  const cards = useQuery(cardsQuery);
  const collections = useQuery(collectionsQuery);
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("de");
  const inCollection = (cards.data ?? []).filter(
    (card) => collectionFilter === undefined || card.collectionId === collectionFilter,
  );
  const visible = normalizedQuery
    ? inCollection.filter(
        (card) =>
          card.front.toLocaleLowerCase("de").includes(normalizedQuery) ||
          card.back.toLocaleLowerCase("de").includes(normalizedQuery),
      )
    : inCollection;
  const hasCards = inCollection.length > 0;
  const selected = cards.data?.find((card) => card.id === selectedId);
  const collectionList = collections.data ?? [];

  const filterBy = (collectionId: string | undefined) =>
    void navigate({ to: "/cards", search: collectionId ? { collection: collectionId } : {} });

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
        {collectionList.length > 1 && (
          <div className={styles.filter} role="group" aria-label={t("collections.filter")}>
            <button
              type="button"
              aria-pressed={collectionFilter === undefined}
              onClick={() => filterBy(undefined)}
            >
              {t("collections.all")}
            </button>
            {collectionList.map((collection) => (
              <button
                key={collection.id}
                type="button"
                aria-pressed={collectionFilter === collection.id}
                onClick={() => filterBy(collection.id)}
              >
                {collection.name}
              </button>
            ))}
          </div>
        )}
        <label htmlFor="card-search">{t("cards.search")}</label>
        <input
          id="card-search"
          type="search"
          placeholder={t("cards.searchHint")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.actions}>
          {hasCards ? (
            <button type="button" onClick={() => setCreating(true)} disabled={!online}>
              {t("cards.add")}
            </button>
          ) : null}
          <button type="button" className={styles.manage} onClick={() => setManaging(true)}>
            {t("collections.manage")}
          </button>
        </div>
        {!online && <p>{t("cards.offline")}</p>}
      </div>
      {cards.isError && cards.data && (
        <p role="status" className={styles.warning}>
          {t("errors.stale")}
        </p>
      )}
      {!hasCards ? (
        <div className={styles.center}>
          <p>{t("cards.empty")}</p>
          <button type="button" onClick={() => setCreating(true)} disabled={!online}>
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
      {creating && (
        <CardFormDialog defaultCollectionId={collectionFilter} onClose={() => setCreating(false)} />
      )}
      {managing && (
        <CollectionManagerDialog
          cardCounts={countCardsByCollection(cards.data ?? [])}
          onClose={() => setManaging(false)}
          onDeleted={(collectionId) => {
            if (collectionId === collectionFilter) filterBy(undefined);
          }}
        />
      )}
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
