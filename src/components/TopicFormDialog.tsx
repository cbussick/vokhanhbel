import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiPaths } from "../contracts/apiPaths";
import { problemTypes } from "../contracts/problem";
import {
  createTopicInputSchema,
  defaultTopicIcon,
  topicIconKeys,
  topicInputSchema,
  topicSchema,
  type Topic,
  type TopicIconKey,
} from "../contracts/topic";
import { apiRequest, ApiError } from "../lib/apiClient";
import { useOnlineStatus } from "../lib/browserState";
import { queryKeys } from "../lib/queryKeys";
import { PendingActionContent } from "./PendingActionContent";
import { TopicIcon } from "./TopicIcon";
import styles from "./Dialog.module.css";

export function TopicFormDialog({
  collectionId,
  topic,
  onClose,
  onCreated,
  onDeleted,
}: {
  collectionId: string;
  topic?: Topic;
  onClose: () => void;
  onCreated?: (topic: Topic) => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(topic?.name ?? "");
  const [icon, setIcon] = useState<TopicIconKey>(topic?.icon ?? defaultTopicIcon);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;
    dialog.showModal();
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  const describeError = (value: unknown, fallback: string) => {
    if (!(value instanceof ApiError)) return fallback;
    if (value.problem.type === problemTypes.topicNameConflict) return t("topics.nameConflict");

    return fallback;
  };

  const save = useMutation({
    mutationFn: async () => {
      const input = topicInputSchema.parse({ name, icon });

      return topicSchema.parse(
        topic
          ? await apiRequest(apiPaths.topic(topic.id), {
              method: "PATCH",
              body: JSON.stringify(input),
            })
          : await apiRequest(apiPaths.topics, {
              method: "POST",
              body: JSON.stringify(createTopicInputSchema.parse({ collectionId, ...input })),
            }),
      );
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.topics });
      if (!topic) onCreated?.(saved);

      dialogRef.current?.close();
      onClose();
    },
    onError: (value) => setError(describeError(value, t("topics.saveFailed"))),
  });

  const remove = useMutation({
    mutationFn: async () => apiRequest<void>(apiPaths.topic(topic!.id), { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.topics });
      await queryClient.invalidateQueries({ queryKey: queryKeys.cards });

      dialogRef.current?.close();
      onDeleted?.();
      onClose();
    },
    onError: (value) => {
      setIsConfirmingDelete(false);
      setError(describeError(value, t("topics.deleteFailed")));
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
      setError(t("topics.offline"));

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

        if (isPending) return;

        if (isConfirmingDelete) {
          setIsConfirmingDelete(false);

          return;
        }

        close();
      }}
      aria-labelledby="topic-dialog-title"
    >
      <section className={styles.sheet} aria-busy={isPending}>
        <header>
          <h2 id="topic-dialog-title">{t(topic ? "topics.renameTitle" : "topics.create")}</h2>
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
              <p>{t("topics.deleteConfirm", { name: topic?.name ?? "" })}</p>
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
                    label={t("topics.delete")}
                    pendingLabel={t("common.deleting")}
                  />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor="topic-name" className={styles.fieldHeading}>
                {t("topics.name")}
              </label>
              <span id="topic-name-hint" className={styles.hint}>
                {t("topics.nameHint")}
              </span>
              <input
                ref={nameRef}
                id="topic-name"
                aria-describedby="topic-name-hint"
                required
                maxLength={60}
                value={name}
                disabled={isPending}
                onChange={(event) => setName(event.target.value)}
              />
              <fieldset className={styles.iconChoices} disabled={isPending}>
                <legend className={styles.fieldHeading}>{t("topics.icon")}</legend>
                {topicIconKeys.map((key) => (
                  <div key={key}>
                    <input
                      type="radio"
                      id={`topic-icon-${key}`}
                      name="topic-icon"
                      value={key}
                      checked={icon === key}
                      onChange={() => setIcon(key)}
                    />
                    <label htmlFor={`topic-icon-${key}`}>
                      <TopicIcon icon={key} />
                      {t(`topics.icons.${key}`)}
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
                {topic && (
                  <button
                    type="button"
                    className={styles.deleteLink}
                    disabled={isPending}
                    onClick={() => {
                      setError(undefined);
                      setIsConfirmingDelete(true);
                    }}
                  >
                    {t("topics.delete")}
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
        </div>
      </section>
    </dialog>
  );
}
