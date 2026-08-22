import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  cardSchema,
  createCardInputSchema,
  updateCardInputSchema,
  type Card,
} from "../contracts/card";
import { apiPaths } from "../contracts/apiPaths";
import { problemTypes } from "../contracts/problem";
import { ApiError, apiRequest } from "../lib/apiClient";
import { useOnlineStatus } from "../lib/browserState";
import { collectionsQuery, topicsQuery } from "../lib/queries";
import { queryKeys } from "../lib/queryKeys";
import { CollectionSelect } from "./CollectionSelect";
import { PendingActionContent } from "./PendingActionContent";
import { TopicSelect } from "./TopicSelect";
import { AudioInput, releaseAudioDraft, type AudioDraft } from "./audio/AudioInput";
import { stageAudioDraft } from "./audio/audioApi";
import styles from "./Dialog.module.css";

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

export function CardFormDialog({
  card,
  defaultCollectionId,
  defaultTopicIds,
  onClose,
  onDeleted,
}: {
  card?: Card;
  defaultCollectionId?: string | undefined;
  defaultTopicIds?: string[] | undefined;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const collections = useQuery(collectionsQuery);
  const topics = useQuery(topicsQuery);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);

  const [collectionId, setCollectionId] = useState(card?.collectionId ?? defaultCollectionId ?? "");
  const [topicIds, setTopicIds] = useState(card?.topicIds ?? defaultTopicIds ?? []);
  const [front, setFront] = useState(card?.front.text ?? "");
  const [back, setBack] = useState(card?.back.text ?? "");
  const [frontDraft, setFrontDraft] = useState<AudioDraft | null>(null);
  const [backDraft, setBackDraft] = useState<AudioDraft | null>(null);
  const [frontAudioRemoved, setFrontAudioRemoved] = useState(false);
  const [backAudioRemoved, setBackAudioRemoved] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;
    dialog.showModal();
    requestAnimationFrame(() => frontRef.current?.focus());
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const stagedIds: string[] = [];

      try {
        const stagedFront = frontDraft ? await stageAudioDraft(frontDraft.blob) : undefined;

        if (stagedFront) stagedIds.push(stagedFront.id);
        const stagedBack = backDraft ? await stageAudioDraft(backDraft.blob) : undefined;

        if (stagedBack) stagedIds.push(stagedBack.id);
        const value = {
          collectionId,
          topicIds,
          front: {
            text: front.trim() ? front : null,
            audioId:
              stagedFront?.id ?? (frontAudioRemoved ? null : (card?.front.audio?.id ?? null)),
          },
          back: {
            text: back.trim() ? back : null,
            audioId: stagedBack?.id ?? (backAudioRemoved ? null : (card?.back.audio?.id ?? null)),
          },
        };
        const input = card
          ? updateCardInputSchema.parse(value)
          : createCardInputSchema.parse(value);
        const saved = cardSchema.parse(
          await apiRequest(card ? apiPaths.card(card.id) : apiPaths.cards, {
            method: card ? "PATCH" : "POST",
            body: JSON.stringify(input),
          }),
        );

        return saved;
      } catch (value) {
        await Promise.allSettled(
          stagedIds.map((audioId) => apiRequest(apiPaths.audio(audioId), { method: "DELETE" })),
        );
        throw value;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cards });

      releaseAudioDraft(frontDraft);
      releaseAudioDraft(backDraft);
      dialogRef.current?.close();
      onClose();
    },
    onError: (value) =>
      setError(
        value instanceof ApiError && value.problem.type === problemTypes.cardFrontConflict
          ? t("cards.conflict")
          : t("cards.saveFailed"),
      ),
  });

  const remove = useMutation({
    mutationFn: async () => apiRequest<void>(apiPaths.card(card!.id), { method: "DELETE" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cards }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
      ]);

      dialogRef.current?.close();
      onDeleted?.();
      onClose();
    },
  });

  const isPending = save.isPending || remove.isPending;

  const close = () => {
    if (isPending) return;

    releaseAudioDraft(frontDraft);
    releaseAudioDraft(backDraft);
    dialogRef.current?.close();
    onClose();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    if (isPending) return;

    setError(undefined);

    if (!online) {
      setError(t("cards.offline"));

      return;
    }

    save.mutate();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();

        if (isPending) return;

        if (isConfirmingDelete) {
          setIsConfirmingDelete(false);

          return;
        }

        close();
      }}
      aria-labelledby="card-dialog-title"
    >
      <section className={styles.sheet} aria-busy={isPending}>
        <header>
          <h2 id="card-dialog-title">{t(card ? "cards.edit" : "cards.create")}</h2>
          {!isConfirmingDelete && (
            <button
              type="button"
              className={styles.iconButton}
              disabled={isPending}
              onClick={close}
              aria-label={t("common.close")}
            >
              ×
            </button>
          )}
        </header>
        <div className={styles.body}>
          {isConfirmingDelete ? (
            <div className={styles.confirm}>
              <p>{t("cards.deleteConfirm")}</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={remove.isPending}
                  onClick={() => setIsConfirmingDelete(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  aria-busy={remove.isPending}
                  aria-disabled={remove.isPending}
                  onClick={() => {
                    if (!remove.isPending) remove.mutate();
                  }}
                >
                  <PendingActionContent
                    pending={remove.isPending}
                    label={t("cards.delete")}
                    pendingLabel={t("common.deleting")}
                  />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor="card-collection" className={styles.fieldHeading}>
                {t("cards.collection")}
              </label>
              <CollectionSelect
                id="card-collection"
                collections={collections.data ?? []}
                value={collectionId}
                onChange={(nextCollectionId) => {
                  setCollectionId(nextCollectionId);
                  setTopicIds([]);
                }}
                required
                disabled={isPending}
              />
              <label htmlFor="card-topics" className={styles.fieldHeading}>
                {t("cards.topics")}
              </label>
              <TopicSelect
                id="card-topics"
                topics={(topics.data ?? []).filter((topic) => topic.collectionId === collectionId)}
                value={topicIds}
                onChange={setTopicIds}
                disabled={isPending}
              />
              <fieldset className={styles.faceEditor} disabled={isPending}>
                <legend id="front-face-label" className={styles.fieldHeading}>
                  {t("cards.front")}
                </legend>
                <span id="front-media-hint" className={styles.hint}>
                  {t("cards.faceMediaHint")}
                </span>
                <div className={styles.faceControl}>
                  <div className={styles.textControl}>
                    <div className={styles.mediaLabel}>
                      <span className={styles.mediaIcon} aria-hidden="true">
                        <TextIcon />
                      </span>
                      {t("cards.text")}
                    </div>
                    <label id="front-text-label" htmlFor="card-front">
                      {t("cards.textLabel")}
                    </label>
                    <textarea
                      ref={frontRef}
                      id="card-front"
                      aria-labelledby="front-face-label front-text-label"
                      aria-describedby="front-media-hint"
                      maxLength={1_000}
                      value={front}
                      onChange={(event) => setFront(event.target.value)}
                    />
                  </div>
                  <AudioInput
                    face="front"
                    draft={frontDraft}
                    existing={card?.front.audio ?? null}
                    existingRemoved={frontAudioRemoved}
                    onDraftChange={setFrontDraft}
                    onExistingRemovedChange={setFrontAudioRemoved}
                  />
                </div>
              </fieldset>
              <fieldset className={styles.faceEditor} disabled={isPending}>
                <legend id="back-face-label" className={styles.fieldHeading}>
                  {t("cards.back")}
                </legend>
                <span id="back-media-hint" className={styles.hint}>
                  {t("cards.faceMediaHint")}
                </span>
                <div className={styles.faceControl}>
                  <div className={styles.textControl}>
                    <div className={styles.mediaLabel}>
                      <span className={styles.mediaIcon} aria-hidden="true">
                        <TextIcon />
                      </span>
                      {t("cards.text")}
                    </div>
                    <label id="back-text-label" htmlFor="card-back">
                      {t("cards.textLabel")}
                    </label>
                    <textarea
                      id="card-back"
                      aria-labelledby="back-face-label back-text-label"
                      aria-describedby="back-media-hint"
                      maxLength={1_000}
                      value={back}
                      onChange={(event) => setBack(event.target.value)}
                    />
                  </div>
                  <AudioInput
                    face="back"
                    draft={backDraft}
                    existing={card?.back.audio ?? null}
                    existingRemoved={backAudioRemoved}
                    onDraftChange={setBackDraft}
                    onExistingRemovedChange={setBackAudioRemoved}
                  />
                </div>
              </fieldset>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              <div className={styles.actions}>
                {card && (
                  <button
                    type="button"
                    className={styles.deleteLink}
                    disabled={isPending}
                    onClick={() => setIsConfirmingDelete(true)}
                  >
                    {t("cards.delete")}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={isPending}
                  onClick={close}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className={styles.primary}
                  aria-busy={save.isPending}
                  aria-disabled={save.isPending}
                  disabled={
                    !collectionId ||
                    (!front.trim() && !frontDraft && (frontAudioRemoved || !card?.front.audio)) ||
                    (!back.trim() && !backDraft && (backAudioRemoved || !card?.back.audio))
                  }
                >
                  <PendingActionContent
                    pending={save.isPending}
                    label={t("common.save")}
                    pendingLabel={t("common.saving")}
                  />
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </dialog>
  );
}
