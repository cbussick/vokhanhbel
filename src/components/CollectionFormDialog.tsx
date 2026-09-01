import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiPaths } from "../contracts/apiPaths";
import {
  collectionIconKeys,
  collectionInputSchema,
  collectionLanguages,
  collectionSchema,
  defaultCollectionIcon,
  type Collection,
  type CollectionIconKey,
  type CollectionLanguage,
} from "../contracts/collection";
import { problemTypes } from "../contracts/problem";
import { apiRequest, ApiError } from "../lib/apiClient";
import { useOnlineStatus } from "../lib/browserState";
import { queryKeys } from "../lib/queryKeys";
import { CollectionIcon } from "./CollectionIcon";
import { Dialog } from "./Dialog";
import { PendingActionContent } from "./PendingActionContent";
import styles from "./Dialog.module.css";

/**
 * The empty option is the stored null, not a locale standing in for "not a language". Leaving it
 * chosen is what says a face has no language, so the field needs no separate yes/no step.
 */
function LanguageField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: CollectionLanguage | null;
  disabled: boolean;
  onChange: (language: CollectionLanguage | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <label htmlFor={id} className={styles.fieldHeading}>
        {label}
      </label>
      <span id={`${id}-hint`} className={styles.hint}>
        {t("collections.languageHint")}
      </span>
      <select
        id={id}
        aria-describedby={`${id}-hint`}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) =>
          onChange(collectionLanguages.find((language) => language === event.target.value) ?? null)
        }
      >
        <option value="">{t("collections.noLanguage")}</option>
        {collectionLanguages.map((language) => (
          <option key={language} value={language}>
            {t(`collections.languages.${language}`)}
          </option>
        ))}
      </select>
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
      const input = collectionInputSchema.parse({ name, icon, frontLanguage, backLanguage });

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
            id="collection-front-language"
            label={t("collections.frontLanguage")}
            value={frontLanguage}
            disabled={isPending}
            onChange={setFrontLanguage}
          />
          <LanguageField
            id="collection-back-language"
            label={t("collections.backLanguage")}
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
