import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { collectionsQuery } from "../lib/queries";
import { queryKeys } from "../lib/queryKeys";
import styles from "./Dialog.module.css";
import collectionStyles from "./CollectionManagerDialog.module.css";

interface CollectionManagerDialogProps {
  cardCounts: Map<string, number>;
  onClose: () => void;
  onDeleted: (collectionId: string) => void;
}

export function CollectionManagerDialog({
  cardCounts,
  onClose,
  onDeleted,
}: CollectionManagerDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const collections = useQuery(collectionsQuery);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Collection>();
  const [confirmation, setConfirmation] = useState<Collection>();
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

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.collections });
  };

  const save = useMutation({
    mutationFn: async () => {
      const input = createCollectionInputSchema.parse({ name });

      return collectionSchema.parse(
        editing
          ? await apiRequest(apiPaths.collection(editing.id), {
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
      await refresh();

      setName("");
      setEditing(undefined);
    },
    onError: (value) => setError(describeError(value, t("collections.saveFailed"))),
  });

  const remove = useMutation({
    mutationFn: async (collection: Collection) =>
      apiRequest<void>(apiPaths.collection(collection.id), { method: "DELETE" }),
    onSuccess: async (_result, collection) => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: queryKeys.cards })]);

      setConfirmation(undefined);
      onDeleted(collection.id);
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

  const startRename = (collection: Collection) => {
    setError(undefined);
    setEditing(collection);
    setName(collection.name);
    nameRef.current?.focus();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="collection-dialog-title"
    >
      <section className={styles.sheet}>
        <header>
          <h2 id="collection-dialog-title">{t("collections.manage")}</h2>
          <button
            type="button"
            className={styles.iconButton}
            onClick={close}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>
        {confirmation ? (
          <div className={styles.confirm}>
            <p>{t("collections.deleteConfirm", { name: confirmation.name })}</p>
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
                onClick={() => remove.mutate(confirmation)}
              >
                {t("collections.delete")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className={collectionStyles.list}>
              {(collections.data ?? []).map((collection) => (
                <li key={collection.id}>
                  <div>
                    <strong>{collection.name}</strong>
                    <span>
                      {t("collections.cardCount", { count: cardCounts.get(collection.id) ?? 0 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={!online}
                    onClick={() => startRename(collection)}
                  >
                    {t("collections.rename")}
                  </button>
                  <button
                    type="button"
                    className={collectionStyles.remove}
                    disabled={!online}
                    aria-label={t("collections.delete")}
                    onClick={() => {
                      setError(undefined);
                      setConfirmation(collection);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {(collections.data?.length ?? 0) === 0 && <p>{t("collections.empty")}</p>}
            <form onSubmit={submit} noValidate>
              <label htmlFor="collection-name">
                {editing ? t("collections.renameTitle") : t("collections.add")}
              </label>
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
                {editing && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      setEditing(undefined);
                      setName("");
                    }}
                  >
                    {t("common.cancel")}
                  </button>
                )}
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={save.isPending || !name.trim()}
                >
                  {t("common.save")}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </dialog>
  );
}
