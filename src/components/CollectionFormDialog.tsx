import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import { Dialog } from "./Dialog";
import { LanguageSelect } from "./LanguageSelect";
import { PendingActionContent } from "./PendingActionContent";
import styles from "./Dialog.module.css";

function LanguageField({
  face,
  value,
  disabled,
  onChange,
}: {
  face: "front" | "back";
  value: string | null;
  disabled: boolean;
  onChange: (language: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = `collection-${face}-language`;

  return (
    <>
      <label htmlFor={id} className={styles.fieldHeading}>
        {t(`collections.${face}Language`)}
      </label>
      <span id={`${id}-hint`} className={styles.hint}>
        {t("collections.languageHint")}
      </span>
      <LanguageSelect
        id={id}
        describedBy={`${id}-hint`}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </>
  );
}

export function CollectionFormDialog({
  collection,
  onClose,
  onCreated,
  onDeleted,
}: {
  collection?: Collection;
  onClose: () => void;
  onCreated?: (collection: Collection) => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(collection?.name ?? "");
  const [icon, setIcon] = useState<CollectionIconKey>(collection?.icon ?? defaultCollectionIcon);
  const [frontLanguage, setFrontLanguage] = useState(collection?.frontLanguage ?? null);
  const [backLanguage, setBackLanguage] = useState(collection?.backLanguage ?? null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string>();

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
      // Only a language the Learner actually changed goes on the wire. Leaving an untouched one
      // out keeps a locale this build cannot offer exactly as declared, and a Collection with no
      // language sends the same request it did before Collections had languages at all.
      const input = collectionInputSchema.parse({
        name,
        icon,
        ...(frontLanguage !== (collection?.frontLanguage ?? null) && { frontLanguage }),
        ...(backLanguage !== (collection?.backLanguage ?? null) && { backLanguage }),
      });

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
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.collections });
      if (!collection) onCreated?.(saved);

      dialogRef.current?.close();
      onClose();
    },
    onError: (value) => setError(describeError(value, t("collections.saveFailed"))),
  });

  const remove = useMutation({
    mutationFn: async () =>
      apiRequest<void>(apiPaths.collection(collection!.id), { method: "DELETE" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.collections }),
        queryClient.invalidateQueries({ queryKey: queryKeys.topics }),
      ]);

      dialogRef.current?.close();
      onDeleted?.();
      onClose();
    },
    onError: (value) => {
      setIsConfirmingDelete(false);
      setError(describeError(value, t("collections.deleteFailed")));
    },
  });

  const isPending = save.isPending || remove.isPending;

  const close = () => {
    if (isPending) return;

    dialogRef.current?.close();
    onClose();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    if (isPending) return;

    setError(undefined);

    if (!online) {
      setError(t("collections.offline"));

      return;
    }

    save.mutate();
  };

  return (
    <Dialog
      dialogRef={dialogRef}
      initialFocusRef={nameRef}
      titleId="collection-dialog-title"
      title={t(collection ? "collections.renameTitle" : "collections.create")}
      busy={isPending}
      isConfirming={isConfirmingDelete}
      onDismissConfirmation={() => setIsConfirmingDelete(false)}
      onClose={close}
    >
      {isConfirmingDelete ? (
        <div className={styles.confirm}>
          <p>{t("collections.deleteConfirm", { name: collection?.name ?? "" })}</p>
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
                label={t("collections.delete")}
                pendingLabel={t("common.deleting")}
              />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="collection-name" className={styles.fieldHeading}>
            {t("collections.name")}
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
            disabled={isPending}
            onChange={(event) => setName(event.target.value)}
          />
          <fieldset className={styles.iconChoices} disabled={isPending}>
            <legend className={styles.fieldHeading}>{t("collections.icon")}</legend>
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
          <LanguageField
            face="front"
            value={frontLanguage}
            disabled={isPending}
            onChange={setFrontLanguage}
          />
          <LanguageField
            face="back"
            value={backLanguage}
            disabled={isPending}
            onChange={setBackLanguage}
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
                disabled={isPending}
                onClick={() => {
                  setError(undefined);
                  setIsConfirmingDelete(true);
                }}
              >
                {t("collections.delete")}
              </button>
            )}
            <button type="button" className={styles.secondary} disabled={isPending} onClick={close}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className={styles.primary}
              aria-busy={save.isPending}
              aria-disabled={save.isPending}
              disabled={!name.trim()}
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
    </Dialog>
  );
}
