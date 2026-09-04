import { useTranslation } from "react-i18next";
import { collectionLanguages, offeredCollectionLanguage } from "../contracts/collection";
import { ListboxOption } from "../shared/ui/ListboxOption";
import { ListboxRoot } from "../shared/ui/ListboxRoot";
import { useListbox } from "../shared/ui/useListbox";
import styles from "./CollectionSelect.module.css";

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

  const options: (string | null)[] = [
    null,
    ...collectionLanguages,
    // A Collection may carry a locale a newer build declared. Listing it keeps it selectable, and
    // so keeps it intact, instead of silently swapping the Learner's declaration for another.
    ...(value !== null && !offeredCollectionLanguage(value) ? [value] : []),
  ];
  const listbox = useListbox({
    optionCount: options.length,
    selectedIndex: options.indexOf(value),
    onActivate: (index) => select(index),
    disabled,
  });

  const label = (language: string | null) => {
    if (language === null) return t("collections.noLanguage");

    const offered = offeredCollectionLanguage(language);

    // A locale this build does not offer has no translated name, so it shows as the locale itself.
    return offered ? t(`collections.languages.${offered}`) : language;
  };

  const select = (index: number) => {
    const option = options[index];

    if (option === undefined) return;

    onChange(option);
    listbox.setActiveIndex(index);
    listbox.close();
  };

  return (
    <ListboxRoot rootRef={listbox.rootRef} className={styles.root} onFocusLeave={listbox.close}>
      <button
        id={id}
        type="button"
        role="combobox"
        className={styles.trigger}
        aria-controls={listbox.listboxId}
        aria-describedby={describedBy}
        aria-expanded={listbox.isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={
          listbox.isOpen ? `${listbox.listboxId}-${listbox.activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={listbox.toggle}
        onKeyDown={listbox.handleKeyDown}
      >
        <span className={styles.value}>{label(value)}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {listbox.isOpen && (
        <ul id={listbox.listboxId} role="listbox" className={styles.listbox} aria-labelledby={id}>
          {options.map((language, index) => (
            <ListboxOption
              optionRef={listbox.optionRef(index)}
              id={`${listbox.listboxId}-${index}`}
              key={language ?? "none"}
              className={styles.option}
              selected={language === value}
              active={index === listbox.activeIndex}
              onActivate={() => select(index)}
              onActive={() => listbox.setActiveIndex(index)}
            >
              <span>{label(language)}</span>
            </ListboxOption>
          ))}
        </ul>
      )}
    </ListboxRoot>
  );
}
