import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Collection } from "../contracts/collection";
import { AddIcon } from "./AddIcon";
import { CollectionIcon } from "./CollectionIcon";
import styles from "./CollectionSelect.module.css";

const typeAheadResetMilliseconds = 500;

export function CollectionSelect({
  id,
  collections,
  value,
  onChange,
  onCreate,
  required = false,
  disabled = false,
}: {
  id: string;
  collections: readonly Collection[];
  value: string;
  onChange: (collectionId: string) => void;
  onCreate?: () => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeAhead = useRef({ query: "", lastKeyAt: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const canCreate = Boolean(onCreate);
  const createIndex = collections.length;
  const lastIndex = canCreate ? createIndex : Math.max(collections.length - 1, 0);
  const isListboxOpen = isOpen && !disabled && (collections.length > 0 || canCreate);
  const selectedIndex = collections.findIndex((collection) => collection.id === value);
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));
  const selectedCollection = collections[selectedIndex];

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

  const open = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const select = (index: number) => {
    if (canCreate && index === createIndex) {
      setIsOpen(false);
      onCreate?.();

      return;
    }

    const collection = collections[index];

    if (!collection) return;

    onChange(collection.id);
    setActiveIndex(index);
    setIsOpen(false);
  };

  const moveActive = (offset: number) => {
    if (collections.length === 0 && !canCreate) return;

    setActiveIndex((current) => Math.min(Math.max(current + offset, 0), lastIndex));
  };

  const matchTypeAhead = (key: string) => {
    const now = Date.now();
    const accumulatedQuery =
      now - typeAhead.current.lastKeyAt > typeAheadResetMilliseconds
        ? key
        : `${typeAhead.current.query}${key}`;
    const query = accumulatedQuery.split(key).every((segment) => segment === "")
      ? key
      : accumulatedQuery;
    typeAhead.current = { query, lastKeyAt: now };

    const startIndex = isOpen ? activeIndex : Math.max(selectedIndex, 0);
    const matchOffset = Array.from({ length: collections.length }, (_, offset) =>
      collections[(startIndex + offset + 1) % collections.length]!.name.toLocaleLowerCase(
        "de",
      ).startsWith(query.toLocaleLowerCase("de")),
    ).findIndex(Boolean);

    if (matchOffset < 0) return;

    const matchIndex = (startIndex + matchOffset + 1) % collections.length;

    setActiveIndex(matchIndex);
    setIsOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey && event.key === "ArrowUp" && isOpen) {
      event.preventDefault();
      select(activeIndex);

      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (isOpen) moveActive(1);
        else open();
        break;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen) moveActive(-1);
        else open(selectedIndex >= 0 ? selectedIndex : lastIndex);
        break;
      case "Home":
        event.preventDefault();
        if (isOpen) setActiveIndex(0);
        else open(0);
        break;
      case "End":
        event.preventDefault();
        if (isOpen) setActiveIndex(lastIndex);
        else open(lastIndex);
        break;
      case "PageUp":
        if (!isOpen) break;
        event.preventDefault();
        moveActive(-10);
        break;
      case "PageDown":
        if (!isOpen) break;
        event.preventDefault();
        moveActive(10);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen) select(activeIndex);
        else open();
        break;
      case "Escape":
        if (!isOpen) break;
        event.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        if (isOpen) select(activeIndex);
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
        className={styles.trigger}
        aria-controls={listboxId}
        aria-expanded={isListboxOpen}
        aria-required={required}
        aria-activedescendant={isListboxOpen ? `${listboxId}-${activeIndex}` : undefined}
        disabled={disabled || (collections.length === 0 && !canCreate)}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        {selectedCollection && <CollectionIcon icon={selectedCollection.icon} size="compact" />}
        <span className={styles.value}>{selectedCollection?.name}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {isListboxOpen && (
        <ul id={listboxId} role="listbox" className={styles.listbox} aria-labelledby={id}>
          {collections.map((collection, index) => {
            const isActive = index === activeIndex;

            return (
              <li
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                id={`${listboxId}-${index}`}
                key={collection.id}
                role="option"
                className={styles.option}
                aria-selected={collection.id === value}
                data-active={isActive || undefined}
                onPointerDown={(event) => {
                  event.preventDefault();
                  select(index);
                }}
                onPointerMove={() => setActiveIndex(index)}
              >
                <CollectionIcon icon={collection.icon} size="compact" />
                <span>{collection.name}</span>
              </li>
            );
          })}
          {canCreate && (
            <li
              ref={(element) => {
                optionRefs.current[createIndex] = element;
              }}
              id={`${listboxId}-${createIndex}`}
              role="option"
              className={`${styles.option} ${styles.createOption}`}
              aria-selected="false"
              data-active={activeIndex === createIndex || undefined}
              onPointerDown={(event) => {
                event.preventDefault();
                select(createIndex);
              }}
              onPointerMove={() => setActiveIndex(createIndex)}
            >
              <AddIcon />
              <span>{t("collections.create")}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
