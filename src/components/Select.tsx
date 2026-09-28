import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ListboxOption } from "../shared/ui/ListboxOption";
import { ListboxRoot } from "../shared/ui/ListboxRoot";
import { useListbox } from "../shared/ui/useListbox";
import styles from "./Select.module.css";

export interface SelectOption<Value extends string | null = string> {
  /** Values must be unique. Null can be an explicit option, distinct from no selection. */
  value: Value;
  label: string;
  /** Decorative content only; the label supplies the accessible name. */
  icon?: ReactNode;
}

type SelectProps<Value extends string | null> = {
  id: string;
  options: readonly SelectOption<Value>[];
  describedBy?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  escapeClipping?: boolean;
  /** Preserve the app's existing keyboard variants rather than silently expanding shortcuts. */
  keyboard?: "basic" | "typeahead" | "extended";
  action?: { label: string; icon?: ReactNode; onSelect: () => void };
  className?: string | undefined;
  /** Optional selection summary, such as Topic chips; kept inside the focus/pointer boundary. */
  children?: ReactNode;
} & (
  | { multiple?: false; value: Value | undefined; onChange: (value: Value) => void }
  | { multiple: true; value: readonly Value[]; onChange: (value: Value[]) => void }
);

/**
 * The app's select-only control. Single selection commits on Enter, Space or Tab; multiple
 * selection toggles on Enter/Space and only dismisses on Tab. Both close after choosing an option.
 * Multiple selection keeps the placeholder in the trigger; its summary belongs to the caller.
 */
export function Select<Value extends string | null>(props: SelectProps<Value>) {
  const {
    id,
    options,
    describedBy,
    disabled = false,
    required = false,
    placeholder = "",
    escapeClipping = false,
    keyboard = "extended",
    action,
    className = "",
    children,
  } = props;
  const supportsPopover = typeof CSS !== "undefined" && CSS.supports?.("selector(:popover-open)");
  const floatsListbox = escapeClipping && supportsPopover;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const selectedIndex = props.multiple
    ? -1
    : options.findIndex((option) => option.value === props.value);
  const selectedOption = options[selectedIndex];
  const actionIndex = options.length;
  const listbox = useListbox({
    optionCount: options.length + (action ? 1 : 0),
    // Multiple selection opens at the first option, as TopicSelect has always done.
    selectedIndex,
    onActivate: (index) => select(index),
    commitOnTab: !props.multiple,
    ...(keyboard === "basic"
      ? {}
      : {
          typeAhead: { count: options.length, labelAt: (index: number) => options[index]!.label },
        }),
    disabled,
  });

  const select = (index: number) => {
    if (action && index === actionIndex) {
      listbox.close();
      action.onSelect();

      return;
    }

    const option = options[index];
    if (!option) return;

    if (props.multiple) {
      props.onChange(
        props.value.includes(option.value)
          ? props.value.filter((value) => value !== option.value)
          : [...props.value, option.value],
      );
    } else {
      props.onChange(option.value);
      listbox.setActiveIndex(index);
    }
    listbox.close();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (keyboard === "extended" && listbox.isOpen) {
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        // Dismiss, rather than toggle a membership, when using multiple selection.
        if (props.multiple) listbox.close();
        else select(listbox.activeIndex);

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

  // The existing LanguageSelect top-layer positioning also belongs to the shared control.
  useLayoutEffect(() => {
    const menu = listboxRef.current;
    const trigger = triggerRef.current;
    if (!listbox.isOpen || !floatsListbox || !menu || !trigger || !menu.showPopover) return;

    const position = () => {
      const triggerBox = trigger.getBoundingClientRect();
      const menuHeight = menu.getBoundingClientRect().height;
      const gap = 4;
      const top =
        window.innerHeight - triggerBox.bottom >= menuHeight + gap
          ? triggerBox.bottom + gap
          : Math.max(gap, triggerBox.top - menuHeight - gap);

      menu.style.setProperty("--listbox-top", `${top}px`);
      menu.style.setProperty("--listbox-left", `${triggerBox.left}px`);
      menu.style.setProperty("--listbox-width", `${triggerBox.width}px`);
    };

    menu.showPopover();
    position();
    const dialog = trigger.closest("dialog");
    window.addEventListener("resize", position);
    dialog?.addEventListener("scroll", position, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", position);
      dialog?.removeEventListener("scroll", position, { capture: true });
      if (menu.matches(":popover-open")) menu.hidePopover();
    };
  }, [floatsListbox, listbox.isOpen]);

  return (
    <ListboxRoot
      rootRef={listbox.rootRef}
      className={`${styles.root} ${className}`}
      onFocusLeave={listbox.close}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        className={styles.trigger}
        aria-controls={listbox.listboxId}
        aria-describedby={describedBy}
        aria-expanded={listbox.isOpen}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        aria-activedescendant={
          listbox.isOpen ? `${listbox.listboxId}-${listbox.activeIndex}` : undefined
        }
        disabled={disabled || (options.length === 0 && !action)}
        onClick={listbox.toggle}
        onKeyDown={handleKeyDown}
      >
        {selectedOption?.icon && (
          <span className={styles.icon} aria-hidden="true">
            {selectedOption.icon}
          </span>
        )}
        <span className={styles.value}>{selectedOption?.label ?? placeholder}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {listbox.isOpen && (
        <ul
          ref={listboxRef}
          id={listbox.listboxId}
          role="listbox"
          className={`${styles.listbox} ${escapeClipping ? styles.floatingListbox : ""}`}
          aria-labelledby={id}
          aria-multiselectable={props.multiple}
          popover={floatsListbox ? "manual" : undefined}
        >
          {options.map((option, index) => (
            <ListboxOption
              optionRef={listbox.optionRef(index)}
              id={`${listbox.listboxId}-${index}`}
              key={JSON.stringify(option.value)}
              className={styles.option}
              selected={
                props.multiple ? props.value.includes(option.value) : option.value === props.value
              }
              active={index === listbox.activeIndex}
              onActivate={() => select(index)}
              onActive={() => listbox.setActiveIndex(index)}
            >
              {option.icon && (
                <span className={styles.icon} aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </ListboxOption>
          ))}
          {action && (
            <ListboxOption
              optionRef={listbox.optionRef(actionIndex)}
              id={`${listbox.listboxId}-${actionIndex}`}
              className={`${styles.option} ${styles.actionOption}`}
              selected={false}
              active={listbox.activeIndex === actionIndex}
              onActivate={() => select(actionIndex)}
              onActive={() => listbox.setActiveIndex(actionIndex)}
            >
              {action.icon && (
                <span className={styles.icon} aria-hidden="true">
                  {action.icon}
                </span>
              )}
              <span>{action.label}</span>
            </ListboxOption>
          )}
        </ul>
      )}
      {children}
    </ListboxRoot>
  );
}
