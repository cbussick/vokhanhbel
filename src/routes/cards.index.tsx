import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { CollectionFormDialog } from "../components/CollectionFormDialog";
import { CollectionIcon } from "../components/CollectionIcon";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { EmptyCollectionsIcon } from "../components/EmptyCardsIcon";
import { EmptyState } from "../components/EmptyState";
import { IconButton } from "../components/IconButton";
import type { Card } from "../contracts/card";
import { useOnlineStatus } from "../lib/browserState";
import { cardsQuery, collectionsQuery } from "../lib/queries";
import styles from "./cards.module.css";

export const Route = createFileRoute("/cards/")({ component: CollectionsRoute });

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function countCardsByCollection(cards: Card[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const card of cards) counts.set(card.collectionId, (counts.get(card.collectionId) ?? 0) + 1);

  return counts;
}

function CollectionsRoute() {
  const { t } = useTranslation();
  const collections = useQuery(collectionsQuery);
  const cards = useQuery(cardsQuery);
  const online = useOnlineStatus();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    document.title = `${t("cards.title")} | ${t("appName")}`;
  }, [t]);

  const cardCounts = countCardsByCollection(cards.data ?? []);

  let content;

  if (collections.isPending) content = <DelayedSkeleton />;
  else if (collections.isError && !collections.data)
    content = (
      <div className={styles.center}>
        <p>{t("errors.load")}</p>
        <button type="button" onClick={() => void collections.refetch()}>
          {t("common.retry")}
        </button>
      </div>
    );
  else {
    const collectionList = collections.data ?? [];

    content = (
      <>
        {collectionList.length === 0 ? (
          <EmptyState
            text={t("collections.empty")}
            icon={<EmptyCollectionsIcon />}
            action={
              <IconButton icon={<AddIcon />} onClick={() => setCreating(true)} disabled={!online}>
                {t("collections.add")}
              </IconButton>
            }
          />
        ) : (
          <>
            <ul className={`${styles.list} ${styles.collectionList}`}>
              {collectionList.map((collection) => {
                const languageName = (language: string | null) =>
                  language
                    ? t(`collections.languages.${language}`, { defaultValue: language })
                    : t("collections.noLanguage");

                return (
                  <li key={collection.id}>
                    <Link
                      to="/cards/$collectionId"
                      params={{ collectionId: collection.id }}
                      className={styles.collectionCard}
                    >
                      <span className={styles.collectionArtwork} aria-hidden="true">
                        <CollectionIcon icon={collection.icon} size="large" />
                      </span>
                      <span className={styles.collectionDetails}>
                        <span className={styles.collectionCount}>
                          {t("collections.cardCount", {
                            count: cardCounts.get(collection.id) ?? 0,
                          })}
                        </span>
                        <strong>{collection.name}</strong>
                        <span className={styles.collectionLanguages}>
                          <span>
                            {t("cards.front")} · {languageName(collection.frontLanguage)}
                          </span>
                          <span>
                            {t("cards.back")} · {languageName(collection.backLanguage)}
                          </span>
                        </span>
                      </span>
                      <span className={styles.collectionArrow} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className={styles.actions}>
              <button type="button" onClick={() => setCreating(true)} disabled={!online}>
                {t("collections.add")}
              </button>
            </div>
          </>
        )}
        {collections.isError && collections.data && (
          <p role="status" className={styles.warning}>
            {t("errors.stale")}
          </p>
        )}
        {!online && <p className={styles.offline}>{t("collections.offline")}</p>}
      </>
    );
  }

  return (
    <AppShell title={t("cards.title")}>
      {content}
      {creating && <CollectionFormDialog onClose={() => setCreating(false)} />}
    </AppShell>
  );
}
