import { useTranslation } from "react-i18next";
import type { Topic } from "../contracts/topic";
import { AddIcon } from "./AddIcon";
import { Select } from "./Select";
import { TopicIcon } from "./TopicIcon";
import styles from "./TopicSelect.module.css";

export function TopicSelect({
  id,
  topics,
  value,
  onChange,
  onCreate,
  disabled = false,
}: {
  id: string;
  topics: readonly Topic[];
  value: readonly string[];
  onChange: (topicIds: string[]) => void;
  onCreate?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const selected = new Set(value);
  const selectedTopics = topics.filter((topic) => selected.has(topic.id));

  return (
    <Select
      id={id}
      className={styles.root}
      multiple
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={t("topics.addExisting")}
      keyboard="typeahead"
      options={topics.map((topic) => ({
        value: topic.id,
        label: topic.name,
        icon: <TopicIcon icon={topic.icon} size="compact" />,
      }))}
      {...(onCreate
        ? { action: { label: t("topics.create"), icon: <AddIcon />, onSelect: onCreate } }
        : {})}
    >
      {selectedTopics.length > 0 && (
        <ul className={styles.chips}>
          {selectedTopics.map((topic) => (
            <li key={topic.id}>
              <span className={styles.chip}>
                <TopicIcon icon={topic.icon} size="compact" />
                {topic.name}
                <button
                  type="button"
                  className={styles.chipRemove}
                  disabled={disabled}
                  aria-label={t("topics.remove", { name: topic.name })}
                  onClick={() => onChange(value.filter((topicId) => topicId !== topic.id))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Select>
  );
}
