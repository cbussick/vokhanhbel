import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { CardFormDialog } from "../components/CardFormDialog";
import { CollectionFormDialog } from "../components/CollectionFormDialog";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { useOnlineStatus } from "../lib/browserState";
import { cardsQuery, collectionsQuery } from "../lib/queries";
import styles from "./cards.module.css";

export const Route = createFileRoute("/cards/$collectionId")({ component: CollectionCardsRoute });

function CollectionCardsRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { collectionId } = Route.useParams();
  const cards = useQuery(cardsQuery);
  const collections = useQuery(collectionsQuery);
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingCollection, setEditingCollection] = useState(false);

  const collection = collections.data?.find((entry) => entry.id === collectionId);

  useEffect(() => {
    document.title = `${collection?.name ?? t("cards.title")} | ${t("appName")}`;
  }, [collection?.name, t]);

  const normalizedQuery = query.trim().toLocaleLowerCase("de");
  const inCollection = (cards.data ?? []).filter((card) => card.collectionId === collectionId);
  const visible = normalizedQuery
    ? inCollection.filter(
        (card) =>
          card.front.toLocaleLowerCase("de").includes(normalizedQuery) ||
          card.back.toLocaleLowerCase("de").includes(normalizedQuery),
      )
    : inCollection;
  const hasCards = inCollection.length > 0;

  let content;

  if (cards.isPending || collections.isPending) content = <DelayedSkeleton />;
  else if (!collection)
    content = (
      <div className={styles.center}>
        <p>{t("collections.notFound")}</p>
        <Link to="/cards">{t("collections.backToAll")}</Link>
      </div>
    );
  else if (cards.isError && !cards.data)
    content = (
      <div className={styles.center}>
        <p>{t("errors.load")}</p>
        <button type="button" onClick={() => void cards.refetch()}>
          {t("common.retry")}
        </button>
      </div>
    );
  else
    content = (
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
          <div className={styles.actions}>
            {hasCards ? (
              <button type="button" onClick={() => setCreating(true)} disabled={!online}>
                {t("cards.add")}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.manage}
              onClick={() => setEditingCollection(true)}
            >
              {t("collections.edit")}
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
                <Link to="/cards/$collectionId/$cardId" params={{ collectionId, cardId: card.id }}>
                  <strong>{card.front}</strong>
                  <span>{card.back}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {creating && (
          <CardFormDialog defaultCollectionId={collectionId} onClose={() => setCreating(false)} />
        )}
        {editingCollection && collection && (
          <CollectionFormDialog
            collection={collection}
            onClose={() => setEditingCollection(false)}
            onDeleted={() => void navigate({ to: "/cards" })}
          />
        )}
        <Outlet />
      </>
    );

  return (
    <AppShell title={collection?.name ?? t("cards.title")}>
      <Link to="/cards" className={styles.back}>
        <span aria-hidden="true">←</span> {t("collections.backToAll")}
      </Link>
      {content}
    </AppShell>
  );
}
