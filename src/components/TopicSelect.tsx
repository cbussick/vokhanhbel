import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Topic } from "../contracts/topic";
import selectStyles from "./CollectionSelect.module.css";
import { TopicIcon } from "./TopicIcon";
import styles from "./TopicSelect.module.css";

const typeAheadResetMilliseconds = 500;

export function TopicSelect({
  id,
  topics,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  topics: readonly Topic[];
  value: readonly string[];
  onChange: (topicIds: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeAhead = useRef({ query: "", lastKeyAt: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const isListboxOpen = isOpen && !disabled && topics.length > 0;
  const selected = new Set(value);
  const selectedTopics = topics.filter((topic) => selected.has(topic.id));
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isListboxOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isListboxOpen]);

  useEffect(() => {
    if (!isListboxOpen) return;

    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isListboxOpen]);

  const open = (index = 0) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const toggle = (index: number) => {
    const topic = topics[index];

    if (!topic) return;

    onChange(
      selected.has(topic.id)
        ? value.filter((topicId) => topicId !== topic.id)
        : [...value, topic.id],
    );
    setActiveIndex(index);
  };

  const moveActive = (offset: number) => {
    if (topics.length === 0) return;

    setActiveIndex((current) => Math.min(Math.max(current + offset, 0), topics.length - 1));
  };

  const matchTypeAhead = (key: string) => {
    const now = Date.now();
    const accumulatedQuery =
      now - typeAhead.current.lastKeyAt > typeAheadResetMilliseconds
        ? key
        : `${typeAhead.current.query}${key}`;
    const query = [...accumulatedQuery].every((character) => character === key)
      ? key
      : accumulatedQuery;
    typeAhead.current = { query, lastKeyAt: now };

    const startIndex = isOpen ? activeIndex : 0;
    const matchOffset = Array.from({ length: topics.length }, (_, offset) =>
      topics[(startIndex + offset + 1) % topics.length]!.name.toLocaleLowerCase("de").startsWith(
        query.toLocaleLowerCase("de"),
      ),
    ).findIndex(Boolean);

    if (matchOffset < 0) return;

    setActiveIndex((startIndex + matchOffset + 1) % topics.length);
    setIsOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (isOpen) moveActive(1);
        else open();
        break;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen) moveActive(-1);
        else open(topics.length - 1);
        break;
      case "Home":
        event.preventDefault();
        if (isOpen) setActiveIndex(0);
        else open(0);
        break;
      case "End":
        event.preventDefault();
        if (isOpen) setActiveIndex(topics.length - 1);
        else open(topics.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen) toggle(activeIndex);
        else open();
        break;
      case "Escape":
        if (!isOpen) break;
        event.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          matchTypeAhead(event.key);
        }
    }
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        className={selectStyles.trigger}
        aria-controls={listboxId}
        aria-expanded={isListboxOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isListboxOpen ? `${listboxId}-${activeIndex}` : undefined}
        disabled={disabled || topics.length === 0}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        <span className={selectStyles.value}>{t("topics.addExisting")}</span>
        <span className={selectStyles.chevron} aria-hidden="true" />
      </button>
      {isListboxOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className={selectStyles.listbox}
          aria-labelledby={id}
          aria-multiselectable="true"
        >
          {topics.map((topic, index) => {
            const isActive = index === activeIndex;

            return (
              <li
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                id={`${listboxId}-${index}`}
                key={topic.id}
                role="option"
                className={selectStyles.option}
                aria-selected={selected.has(topic.id)}
                data-active={isActive || undefined}
                onPointerDown={(event) => {
                  event.preventDefault();
                  toggle(index);
                }}
                onPointerMove={() => setActiveIndex(index)}
              >
                <TopicIcon icon={topic.icon} size="compact" />
                <span>{topic.name}</span>
              </li>
            );
          })}
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
    </div>
  );
}
