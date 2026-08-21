import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { CardFormDialog } from "../components/CardFormDialog";
import { CollectionFormDialog } from "../components/CollectionFormDialog";
import { CollectionIcon } from "../components/CollectionIcon";
import { DelayedSkeleton } from "../components/DelayedSkeleton";
import { IconButton } from "../components/IconButton";
import { AudioPlayer, formatAudioDuration } from "../components/audio/AudioPlayer";
import { useOnlineStatus } from "../lib/browserState";
import { cardsQuery, collectionsQuery } from "../lib/queries";
import styles from "./cards.module.css";

export const Route = createFileRoute("/cards/$collectionId")({ component: CollectionCardsRoute });

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="m14.5 5.5 4 4M4 20l3.7-.8L19 7.9a2.1 2.1 0 0 0-3-3L4.8 16.2Z" />
    </svg>
  );
}

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
          (card.front.text?.toLocaleLowerCase("de").includes(normalizedQuery) ?? false) ||
          (card.back.text?.toLocaleLowerCase("de").includes(normalizedQuery) ?? false),
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
          <div className={styles.sectionHeader}>
            <h2>{t("cards.title")}</h2>
            {hasCards ? (
              <IconButton icon={<AddIcon />} onClick={() => setCreating(true)} disabled={!online}>
                {t("cards.add")}
              </IconButton>
            ) : null}
          </div>
          <label htmlFor="card-search">{t("cards.search")}</label>
          <input
            id="card-search"
            type="search"
            placeholder={t("cards.searchHint")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
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
            <IconButton icon={<AddIcon />} onClick={() => setCreating(true)} disabled={!online}>
              {t("cards.add")}
            </IconButton>
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
                <div className={styles.rowLayout}>
                  <Link
                    to="/cards/$collectionId/$cardId"
                    params={{ collectionId, cardId: card.id }}
                  >
                    <span className={styles.rowText}>
                      <strong>
                        {card.front.text ??
                          (card.front.audio
                            ? t("audio.duration", {
                                duration: formatAudioDuration(card.front.audio.durationMs),
                              })
                            : "")}
                      </strong>
                      <span className={styles.rowDetail}>
                        {card.back.text ??
                          (card.back.audio
                            ? t("audio.duration", {
                                duration: formatAudioDuration(card.back.audio.durationMs),
                              })
                            : "")}
                      </span>
                    </span>
                  </Link>
                  {card.front.audio || card.back.audio ? (
                    <div className={styles.rowMedia}>
                      {card.front.audio ? (
                        <div className={styles.rowAudio}>
                          <span>{t("audio.front")}</span>
                          <AudioPlayer
                            audio={card.front.audio}
                            label={t("audio.frontLabel")}
                            compact
                          />
                        </div>
                      ) : null}
                      {card.back.audio ? (
                        <div className={styles.rowAudio}>
                          <span>{t("audio.back")}</span>
                          <AudioPlayer
                            audio={card.back.audio}
                            label={t("audio.backLabel")}
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {creating && (
          <CardFormDialog defaultCollectionId={collectionId} onClose={() => setCreating(false)} />
        )}
        {editingCollection && (
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
    <AppShell
      title={collection?.name ?? t("cards.title")}
      titleContext={
        <Link to="/cards" className={styles.back}>
          <span aria-hidden="true">←</span> {t("collections.backToAll")}
        </Link>
      }
      titleIcon={collection && <CollectionIcon icon={collection.icon} />}
      titleAction={
        collection && (
          <IconButton
            icon={<EditIcon />}
            size="compact"
            variant="secondary"
            onClick={() => setEditingCollection(true)}
          >
            {t("collections.edit")}
          </IconButton>
        )
      }
    >
      {content}
    </AppShell>
  );
}
