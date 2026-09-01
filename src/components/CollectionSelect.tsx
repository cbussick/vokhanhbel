import { useTranslation } from "react-i18next";
import type { Collection } from "../contracts/collection";
import { ListboxOption } from "../shared/ui/ListboxOption";
import { ListboxRoot } from "../shared/ui/ListboxRoot";
import { useListbox } from "../shared/ui/useListbox";
import { AddIcon } from "./AddIcon";
import { CollectionIcon } from "./CollectionIcon";
import styles from "./CollectionSelect.module.css";

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
  const canCreate = Boolean(onCreate);
  const createIndex = collections.length;
  const selectedIndex = collections.findIndex((collection) => collection.id === value);
  const selectedCollection = collections[selectedIndex];
  const listbox = useListbox({
    optionCount: canCreate ? collections.length + 1 : collections.length,
    selectedIndex,
    onActivate: (index) => select(index),
    typeAhead: { count: collections.length, labelAt: (index) => collections[index]!.name },
    disabled,
  });

  const select = (index: number) => {
    if (canCreate && index === createIndex) {
      listbox.close();
      onCreate?.();

      return;
    }

    const collection = collections[index];

    if (!collection) return;

    onChange(collection.id);
    listbox.setActiveIndex(index);
    listbox.close();
  };

  // Paging and Alt+Arrow Up stay here: a Collection list is long enough to need them, and the
  // shared listbox behaviour is the ARIA pattern rather than every key a combobox might want.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (listbox.isOpen) {
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        select(listbox.activeIndex);

        return;
      }

      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();
        listbox.moveActive(event.key === "PageUp" ? -10 : 10);

        return;
      }
    }

    listbox.handleKeyDown(event);
  };

  return (
    <ListboxRoot rootRef={listbox.rootRef} className={styles.root} onFocusLeave={listbox.close}>
      <button
        id={id}
        type="button"
        role="combobox"
        className={styles.trigger}
        aria-controls={listbox.listboxId}
        aria-expanded={listbox.isOpen}
        aria-required={required}
        aria-activedescendant={
          listbox.isOpen ? `${listbox.listboxId}-${listbox.activeIndex}` : undefined
        }
        disabled={disabled || (collections.length === 0 && !canCreate)}
        onClick={listbox.toggle}
        onKeyDown={handleKeyDown}
      >
        {selectedCollection && <CollectionIcon icon={selectedCollection.icon} size="compact" />}
        <span className={styles.value}>{selectedCollection?.name}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {listbox.isOpen && (
        <ul id={listbox.listboxId} role="listbox" className={styles.listbox} aria-labelledby={id}>
          {collections.map((collection, index) => {
            const isActive = index === listbox.activeIndex;

            return (
              <ListboxOption
                optionRef={listbox.optionRef(index)}
                id={`${listbox.listboxId}-${index}`}
                key={collection.id}
                className={styles.option}
                selected={collection.id === value}
                active={isActive}
                onActivate={() => select(index)}
                onActive={() => listbox.setActiveIndex(index)}
              >
                <CollectionIcon icon={collection.icon} size="compact" />
                <span>{collection.name}</span>
              </ListboxOption>
            );
          })}
          {canCreate && (
            <ListboxOption
              optionRef={listbox.optionRef(createIndex)}
              id={`${listbox.listboxId}-${createIndex}`}
              className={`${styles.option} ${styles.createOption}`}
              selected={false}
              active={listbox.activeIndex === createIndex}
              onActivate={() => select(createIndex)}
              onActive={() => listbox.setActiveIndex(createIndex)}
            >
              <AddIcon />
              <span>{t("collections.create")}</span>
            </ListboxOption>
          )}
        </ul>
      )}
    </ListboxRoot>
  );
}
