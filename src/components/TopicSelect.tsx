import { useTranslation } from "react-i18next";
import type { Topic } from "../contracts/topic";
import { ListboxOption } from "../shared/ui/ListboxOption";
import { ListboxRoot } from "../shared/ui/ListboxRoot";
import { useListbox } from "../shared/ui/useListbox";
import { AddIcon } from "./AddIcon";
import { TopicIcon } from "./TopicIcon";
import selectStyles from "./CollectionSelect.module.css";
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
  const canCreate = Boolean(onCreate);
  const createIndex = topics.length;
  const selected = new Set(value);
  const selectedTopics = topics.filter((topic) => selected.has(topic.id));
  const listbox = useListbox({
    optionCount: canCreate ? topics.length + 1 : topics.length,
    // Many Topics can be on at once, so no single one decides where opening lands: it lands first.
    selectedIndex: -1,
    onActivate: (index) => toggle(index),
    // Toggling leaves the list open, so Tab has no pending choice to commit.
    commitOnTab: false,
    typeAhead: { count: topics.length, labelAt: (index) => topics[index]!.name },
    disabled,
  });

  const toggle = (index: number) => {
    if (canCreate && index === createIndex) {
      listbox.close();
      onCreate?.();

      return;
    }

    const topic = topics[index];

    if (!topic) return;

    onChange(
      selected.has(topic.id)
        ? value.filter((topicId) => topicId !== topic.id)
        : [...value, topic.id],
    );
    listbox.setActiveIndex(index);
  };

  return (
    <ListboxRoot rootRef={listbox.rootRef} className={styles.root} onFocusLeave={listbox.close}>
      <button
        id={id}
        type="button"
        role="combobox"
        className={selectStyles.trigger}
        aria-controls={listbox.listboxId}
        aria-expanded={listbox.isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={
          listbox.isOpen ? `${listbox.listboxId}-${listbox.activeIndex}` : undefined
        }
        disabled={disabled || (topics.length === 0 && !canCreate)}
        onClick={listbox.toggle}
        onKeyDown={listbox.handleKeyDown}
      >
        <span className={selectStyles.value}>{t("topics.addExisting")}</span>
        <span className={selectStyles.chevron} aria-hidden="true" />
      </button>
      {listbox.isOpen && (
        <ul
          id={listbox.listboxId}
          role="listbox"
          className={selectStyles.listbox}
          aria-labelledby={id}
          aria-multiselectable="true"
        >
          {topics.map((topic, index) => {
            const isActive = index === listbox.activeIndex;

            return (
              <ListboxOption
                optionRef={listbox.optionRef(index)}
                id={`${listbox.listboxId}-${index}`}
                key={topic.id}
                className={selectStyles.option}
                selected={selected.has(topic.id)}
                active={isActive}
                onActivate={() => toggle(index)}
                onActive={() => listbox.setActiveIndex(index)}
              >
                <TopicIcon icon={topic.icon} size="compact" />
                <span>{topic.name}</span>
              </ListboxOption>
            );
          })}
          {canCreate && (
            <ListboxOption
              optionRef={listbox.optionRef(createIndex)}
              id={`${listbox.listboxId}-${createIndex}`}
              className={`${selectStyles.option} ${selectStyles.createOption}`}
              selected={false}
              active={listbox.activeIndex === createIndex}
              onActivate={() => toggle(createIndex)}
              onActive={() => listbox.setActiveIndex(createIndex)}
            >
              <AddIcon />
              <span>{t("topics.create")}</span>
            </ListboxOption>
          )}
        </ul>
      )}
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
    </ListboxRoot>
  );
}
