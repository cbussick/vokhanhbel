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
import { collectionsQuery } from "../lib/queries";
import { queryKeys } from "../lib/queryKeys";
import { CollectionSelect } from "./CollectionSelect";
import { AudioInput, releaseAudioDraft, type AudioDraft } from "./audio/AudioInput";
import { stageAudioDraft } from "./audio/audioApi";
import styles from "./Dialog.module.css";

export function CardFormDialog({
  card,
  defaultCollectionId,
  onClose,
  onDeleted,
}: {
  card?: Card;
  defaultCollectionId?: string | undefined;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const collections = useQuery(collectionsQuery);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);

  const [collectionId, setCollectionId] = useState(card?.collectionId ?? defaultCollectionId ?? "");
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

  const close = () => {
    releaseAudioDraft(frontDraft);
    releaseAudioDraft(backDraft);
    dialogRef.current?.close();
    onClose();
  };

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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
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

        if (isConfirmingDelete) {
          setIsConfirmingDelete(false);

          return;
        }

        close();
      }}
      aria-labelledby="card-dialog-title"
    >
      <section className={styles.sheet}>
        <header>
          <h2 id="card-dialog-title">{t(card ? "cards.edit" : "cards.create")}</h2>
          {!isConfirmingDelete && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={close}
              aria-label={t("common.close")}
            >
              ×
            </button>
          )}
        </header>
        {isConfirmingDelete ? (
          <div className={styles.confirm}>
            <p>{t("cards.deleteConfirm")}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setIsConfirmingDelete(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={styles.danger}
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {t("cards.delete")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label htmlFor="card-collection">{t("cards.collection")}</label>
            <CollectionSelect
              id="card-collection"
              collections={collections.data ?? []}
              value={collectionId}
              onChange={setCollectionId}
              required
            />
            <div className={styles.faceEditor}>
              <label htmlFor="card-front">{t("cards.front")}</label>
              <span id="front-hint" className={styles.hint}>
                {t("cards.frontHint")}
              </span>
              <textarea
                ref={frontRef}
                id="card-front"
                aria-describedby="front-hint"
                maxLength={1_000}
                value={front}
                onChange={(event) => setFront(event.target.value)}
              />
              <div className={styles.audioAttachment}>
                <AudioInput
                  face="front"
                  draft={frontDraft}
                  existing={card?.front.audio ?? null}
                  existingRemoved={frontAudioRemoved}
                  onDraftChange={setFrontDraft}
                  onExistingRemovedChange={setFrontAudioRemoved}
                />
              </div>
            </div>
            <div className={styles.faceEditor}>
              <label htmlFor="card-back">{t("cards.back")}</label>
              <span id="back-hint" className={styles.hint}>
                {t("cards.backHint")}
              </span>
              <textarea
                id="card-back"
                aria-describedby="back-hint"
                maxLength={1_000}
                value={back}
                onChange={(event) => setBack(event.target.value)}
              />
              <div className={styles.audioAttachment}>
                <AudioInput
                  face="back"
                  draft={backDraft}
                  existing={card?.back.audio ?? null}
                  existingRemoved={backAudioRemoved}
                  onDraftChange={setBackDraft}
                  onExistingRemovedChange={setBackAudioRemoved}
                />
              </div>
            </div>
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
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  {t("cards.delete")}
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={close}>
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={
                  save.isPending ||
                  !collectionId ||
                  (!front.trim() && !frontDraft && (frontAudioRemoved || !card?.front.audio)) ||
                  (!back.trim() && !backDraft && (backAudioRemoved || !card?.back.audio))
                }
              >
                {t("common.save")}
              </button>
            </div>
          </form>
        )}
      </section>
    </dialog>
  );
}
