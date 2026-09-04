import { useEffect, useId, useRef, useState } from "react";
import { nextTypeAheadState, type TypeAheadState } from "../../lib/typeAhead";

interface TypeAheadOptions {
  /**
   * How many leading options a query searches. A trailing action row, such as "create", is not a
   * value the Learner can type her way to, so it sits outside this count.
   */
  count: number;
  labelAt: (index: number) => string;
}

/**
 * The collapsed-listbox behaviour every combobox in this app shares: open state, which option is
 * active, closing on an outside pointer or on focus leaving, keeping the active option in view, and
 * the keys the ARIA listbox pattern asks for.
 *
 * What differs between comboboxes stays with them. Activating an option is theirs, because only
 * they know whether choosing means replacing a selection or toggling one, and whether that closes
 * the list. Keys beyond the pattern are theirs too: handle them first, then delegate the rest here.
 */
export function useListbox({
  optionCount,
  selectedIndex,
  onActivate,
  commitOnTab = true,
  typeAhead,
  disabled = false,
}: {
  optionCount: number;
  /** The selected option, or -1 when nothing is selected, which decides where opening lands. */
  selectedIndex: number;
  onActivate: (index: number) => void;
  /** Tab commits the active option. A multi-select listbox has nothing to commit, so it closes. */
  commitOnTab?: boolean;
  typeAhead?: TypeAheadOptions;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const rootElement = useRef<HTMLDivElement>(null);
  const optionElements = useRef<(HTMLLIElement | null)[]>([]);
  const typeAheadState = useRef<TypeAheadState>({ query: "", lastKeyAt: 0 });
  const [isExpanded, setIsExpanded] = useState(false);

  // Opening lands on the selection, or on the first option when there is none. Arrow Up is the one
  // key that opens from the other end instead, which is what makes it worth reaching the last one.
  const firstIndex = Math.max(selectedIndex, 0);
  const lastIndex = Math.max(optionCount - 1, 0);
  const isOpen = isExpanded && !disabled && optionCount > 0;
  const [activeIndex, setActiveIndex] = useState(firstIndex);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      // SAFETY: a pointerdown dispatched on the document always targets a DOM element, so target
      // is a Node. contains() also accepts null, so a null target would still be handled.
      if (!rootElement.current?.contains(event.target as Node)) setIsExpanded(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    optionElements.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const open = (index = firstIndex) => {
    setActiveIndex(index);
    setIsExpanded(true);
  };

  const close = () => setIsExpanded(false);

  const moveActive = (offset: number) => {
    if (optionCount === 0) return;

    setActiveIndex((current) => Math.min(Math.max(current + offset, 0), lastIndex));
  };

  const matchTypeAhead = (key: string) => {
    if (!typeAhead || typeAhead.count === 0) return;

    typeAheadState.current = nextTypeAheadState(typeAheadState.current, key);
    const { count, labelAt } = typeAhead;
    const query = typeAheadState.current.query.toLocaleLowerCase("de");
    const startIndex = isOpen ? activeIndex : firstIndex;
    const matchOffset = Array.from({ length: count }, (_, offset) =>
      labelAt((startIndex + offset + 1) % count)
        .toLocaleLowerCase("de")
        .startsWith(query),
    ).findIndex(Boolean);

    if (matchOffset < 0) return;

    setActiveIndex((startIndex + matchOffset + 1) % count);
    setIsExpanded(true);
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
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen) onActivate(activeIndex);
        else open();
        break;
      case "Escape":
        if (!isOpen) break;
        event.preventDefault();
        close();
        break;
      case "Tab":
        if (!isOpen) break;
        if (commitOnTab) onActivate(activeIndex);
        else close();
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          matchTypeAhead(event.key);
        }
    }
  };

  return {
    listboxId,
    isOpen,
    activeIndex,
    setActiveIndex,
    close,
    moveActive,
    handleKeyDown,
    toggle: () => (isOpen ? close() : open()),
    rootRef: (element: HTMLDivElement | null) => {
      rootElement.current = element;
    },
    optionRef: (index: number) => (element: HTMLLIElement | null) => {
      optionElements.current[index] = element;
    },
  };
}
