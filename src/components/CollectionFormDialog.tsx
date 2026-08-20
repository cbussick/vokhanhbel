import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiPaths } from "../contracts/apiPaths";
import {
  collectionSchema,
  createCollectionInputSchema,
  type Collection,
} from "../contracts/collection";
import { problemTypes } from "../contracts/problem";
import { apiRequest, ApiError } from "../lib/apiClient";
import { useOnlineStatus } from "../lib/browserState";
import { queryKeys } from "../lib/queryKeys";
import styles from "./Dialog.module.css";

export function CollectionFormDialog({
  collection,
  onClose,
  onDeleted,
}: {
  collection?: Collection;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(collection?.name ?? "");
  const [confirmation, setConfirmation] = useState<"delete" | "discard">();
  const [error, setError] = useState<string>();

  const dirty = name !== (collection?.name ?? "");

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;
    dialog.showModal();
    requestAnimationFrame(() => nameRef.current?.focus());
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

  const describeError = (value: unknown, fallback: string) => {
    if (!(value instanceof ApiError)) return fallback;
    if (value.problem.type === problemTypes.collectionNameConflict)
      return t("collections.nameConflict");
    if (value.problem.type === problemTypes.collectionNotEmpty) return t("collections.notEmpty");
    if (value.problem.type === problemTypes.lastCollection) return t("collections.lastCollection");

    return fallback;
  };

  const save = useMutation({
    mutationFn: async () => {
      const input = createCollectionInputSchema.parse({ name });

      return collectionSchema.parse(
        collection
          ? await apiRequest(apiPaths.collection(collection.id), {
              method: "PATCH",
              body: JSON.stringify(input),
            })
          : await apiRequest(apiPaths.collections, {
              method: "POST",
              body: JSON.stringify(input),
            }),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.collections });

      dialogRef.current?.close();
      onClose();
    },
    onError: (value) => setError(describeError(value, t("collections.saveFailed"))),
  });

  const remove = useMutation({
    mutationFn: async () =>
      apiRequest<void>(apiPaths.collection(collection!.id), { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.collections });

      dialogRef.current?.close();
      onDeleted?.();
      onClose();
    },
    onError: (value) => {
      setConfirmation(undefined);
      setError(describeError(value, t("collections.deleteFailed")));
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);

    if (!online) {
      setError(t("collections.offline"));

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
      aria-labelledby="collection-dialog-title"
    >
      <section className={styles.sheet}>
        <header>
          <h2 id="collection-dialog-title">
            {t(collection ? "collections.renameTitle" : "collections.create")}
          </h2>
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
            <p>{t("collections.deleteConfirm", { name: collection?.name ?? "" })}</p>
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
                {t("collections.delete")}
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
            <label htmlFor="collection-name">{t("collections.name")}</label>
            <span id="collection-name-hint" className={styles.hint}>
              {t("collections.nameHint")}
            </span>
            <input
              ref={nameRef}
              id="collection-name"
              aria-describedby="collection-name-hint"
              required
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div className={styles.actions}>
              {collection && (
                <button
                  type="button"
                  className={styles.deleteLink}
                  onClick={() => {
                    setError(undefined);
                    setConfirmation("delete");
                  }}
                >
                  {t("collections.delete")}
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={requestClose}>
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={save.isPending || !name.trim()}
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
