import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiPaths } from "../contracts/apiPaths";
import {
  collectionIconKeys,
  collectionInputSchema,
  collectionSchema,
  defaultCollectionIcon,
  type Collection,
  type CollectionIconKey,
} from "../contracts/collection";
import { problemTypes } from "../contracts/problem";
import { apiRequest, ApiError } from "../lib/apiClient";
import { useOnlineStatus } from "../lib/browserState";
import { queryKeys } from "../lib/queryKeys";
import { CollectionIcon } from "./CollectionIcon";
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
  const [icon, setIcon] = useState<CollectionIconKey>(collection?.icon ?? defaultCollectionIcon);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string>();

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
      const input = collectionInputSchema.parse({ name, icon });

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
      setIsConfirmingDelete(false);
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

        if (isConfirmingDelete) {
          setIsConfirmingDelete(false);

          return;
        }

        close();
      }}
      aria-labelledby="collection-dialog-title"
    >
      <section className={styles.sheet}>
        <header>
          <h2 id="collection-dialog-title">
            {t(collection ? "collections.renameTitle" : "collections.create")}
          </h2>
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
            <p>{t("collections.deleteConfirm", { name: collection?.name ?? "" })}</p>
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
                {t("collections.delete")}
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
            <fieldset className={styles.iconChoices}>
              <legend className={styles.fieldLabel}>{t("collections.icon")}</legend>
              {collectionIconKeys.map((key) => (
                <div key={key}>
                  <input
                    type="radio"
                    id={`collection-icon-${key}`}
                    name="collection-icon"
                    value={key}
                    checked={icon === key}
                    onChange={() => setIcon(key)}
                  />
                  <label htmlFor={`collection-icon-${key}`}>
                    <CollectionIcon icon={key} />
                    {t(`collections.icons.${key}`)}
                  </label>
                </div>
              ))}
            </fieldset>
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
                    setIsConfirmingDelete(true);
                  }}
                >
                  {t("collections.delete")}
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={close}>
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
