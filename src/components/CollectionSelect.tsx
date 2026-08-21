import { useEffect, useId, useRef, useState } from "react";
import type { Collection } from "../contracts/collection";
import { CollectionIcon } from "./CollectionIcon";
import styles from "./CollectionSelect.module.css";

const typeAheadResetMilliseconds = 500;

export function CollectionSelect({
  id,
  collections,
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  id: string;
  collections: readonly Collection[];
  value: string;
  onChange: (collectionId: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeAhead = useRef({ query: "", lastKeyAt: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const isListboxOpen = isOpen && !disabled;
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
    const collection = collections[index];

    if (!collection) return;

    onChange(collection.id);
    setActiveIndex(index);
    setIsOpen(false);
  };

  const moveActive = (offset: number) => {
    if (collections.length === 0) return;

    setActiveIndex((current) => Math.min(Math.max(current + offset, 0), collections.length - 1));
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
        else open(selectedIndex >= 0 ? selectedIndex : collections.length - 1);
        break;
      case "Home":
        event.preventDefault();
        if (isOpen) setActiveIndex(0);
        else open(0);
        break;
      case "End":
        event.preventDefault();
        if (isOpen) setActiveIndex(collections.length - 1);
        else open(collections.length - 1);
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
        disabled={disabled || collections.length === 0}
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
                aria-selected={isActive}
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
        </ul>
      )}
    </div>
  );
}
