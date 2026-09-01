import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  collectionLanguages,
  collectionLanguageSchema,
  type CollectionLanguage,
} from "../contracts/collection";
import { ListboxOption } from "../shared/ui/ListboxOption";
import { ListboxRoot } from "../shared/ui/ListboxRoot";
import styles from "./CollectionSelect.module.css";

/** The stored locale if this build offers it, so a locale from a newer build stays recognisable. */
function offeredLanguage(language: string): CollectionLanguage | undefined {
  const result = collectionLanguageSchema.safeParse(language);

  return result.success ? result.data : undefined;
}

/**
 * The unset option is the stored null, not a locale standing in for "not a language". Offering it
 * in the list is what lets the Learner say a face has no language, so the field needs no separate
 * yes/no step.
 */
export function LanguageSelect({
  id,
  describedBy,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  describedBy?: string;
  value: string | null;
  onChange: (language: string | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const options: (string | null)[] = [
    null,
    ...collectionLanguages,
    // A Collection may carry a locale a newer build declared. Listing it keeps it selectable, and
    // so keeps it intact, instead of silently swapping the Learner's declaration for another.
    ...(value !== null && !offeredLanguage(value) ? [value] : []),
  ];
  const selectedIndex = options.indexOf(value);
  const lastIndex = options.length - 1;
  const isListboxOpen = isOpen && !disabled;
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!isListboxOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      // SAFETY: a pointerdown dispatched on the document always targets a DOM element, so target
      // is a Node. contains() also accepts null, so a null target would still be handled.
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isListboxOpen]);

  useEffect(() => {
    if (!isListboxOpen) return;

    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isListboxOpen]);

  const label = (language: string | null) => {
    if (language === null) return t("collections.noLanguage");

    const offered = offeredLanguage(language);

    // A locale this build does not offer has no translated name, so it shows as the locale itself.
    return offered ? t(`collections.languages.${offered}`) : language;
  };

  const open = (index = selectedIndex) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const select = (index: number) => {
    const option = options[index];

    if (option === undefined) return;

    onChange(option);
    setActiveIndex(index);
    setIsOpen(false);
  };

  const moveActive = (offset: number) =>
    setActiveIndex((current) => Math.min(Math.max(current + offset, 0), lastIndex));

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
        else open();
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
    }
  };

  return (
    <ListboxRoot
      rootRef={(element) => {
        rootRef.current = element;
      }}
      className={styles.root}
      onFocusLeave={() => setIsOpen(false)}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        className={styles.trigger}
        aria-controls={listboxId}
        aria-describedby={describedBy}
        aria-expanded={isListboxOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isListboxOpen ? `${listboxId}-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.value}>{label(value)}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {isListboxOpen && (
        <ul id={listboxId} role="listbox" className={styles.listbox} aria-labelledby={id}>
          {options.map((language, index) => (
            <ListboxOption
              optionRef={(element) => {
                optionRefs.current[index] = element;
              }}
              id={`${listboxId}-${index}`}
              key={language ?? "none"}
              className={styles.option}
              selected={language === value}
              active={index === activeIndex}
              onActivate={() => select(index)}
              onActive={() => setActiveIndex(index)}
            >
              <span>{label(language)}</span>
            </ListboxOption>
          ))}
        </ul>
      )}
    </ListboxRoot>
  );
}
