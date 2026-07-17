import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cardSchema, createCardInputSchema, type Card } from "../contracts/card";
import { apiPaths } from "../contracts/apiPaths";
import { problemTypes } from "../contracts/problem";
import { apiRequest, ApiError } from "../lib/apiClient";
import { useOnlineStatus } from "../lib/browserState";
import { queryKeys } from "../lib/queryKeys";
import styles from "./Dialog.module.css";

export function CardFormDialog({
  card,
  onClose,
  onDeleted,
}: {
  card?: Card;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);

  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [confirmation, setConfirmation] = useState<"delete" | "discard">();
  const [error, setError] = useState<string>();

  const dirty = front !== (card?.front ?? "") || back !== (card?.back ?? "");

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;
    dialog.showModal();
    requestAnimationFrame(() => frontRef.current?.focus());
  }, []);

  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  const requestClose = () => {
    if (dirty) {
      setConfirmation("discard");

      return;
    }

    close();
  };

  const save = useMutation({
    mutationFn: async () => {
      const input = createCardInputSchema.parse({ front, back });

      return card
        ? cardSchema.parse(
            await apiRequest(apiPaths.card(card.id), {
              method: "PATCH",
              body: JSON.stringify(input),
            }),
          )
        : cardSchema.parse(
            await apiRequest(apiPaths.cards, { method: "POST", body: JSON.stringify(input) }),
          );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cards });

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
        event.preventDefault();
        requestClose();
      }}
      aria-labelledby="card-dialog-title"
    >
      <section className={styles.sheet}>
        <header>
          <h2 id="card-dialog-title">{t(card ? "cards.edit" : "cards.create")}</h2>
          <button
            type="button"
            className={styles.iconButton}
            onClick={requestClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>
        {confirmation === "delete" ? (
          <div className={styles.confirm}>
            <p>{t("cards.deleteConfirm")}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setConfirmation(undefined)}
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
        ) : confirmation === "discard" ? (
          <div className={styles.confirm}>
            <p>{t("cards.unsaved")}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setConfirmation(undefined)}
              >
                {t("common.keepEditing")}
              </button>
              <button type="button" className={styles.danger} onClick={close}>
                {t("common.discard")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label htmlFor="card-front">{t("cards.front")}</label>
            <span id="front-hint" className={styles.hint}>
              {t("cards.frontHint")}
            </span>
            <textarea
              ref={frontRef}
              id="card-front"
              aria-describedby="front-hint"
              required
              maxLength={200}
              value={front}
              onChange={(event) => setFront(event.target.value)}
            />
            <label htmlFor="card-back">{t("cards.back")}</label>
            <span id="back-hint" className={styles.hint}>
              {t("cards.backHint")}
            </span>
            <textarea
              id="card-back"
              aria-describedby="back-hint"
              required
              maxLength={1_000}
              value={back}
              onChange={(event) => setBack(event.target.value)}
            />
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
                  onClick={() => setConfirmation("delete")}
                >
                  {t("cards.delete")}
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={requestClose}>
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={save.isPending || !front.trim() || !back.trim()}
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
