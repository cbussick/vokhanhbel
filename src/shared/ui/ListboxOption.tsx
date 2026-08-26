import type { ReactNode } from "react";

/* oxlint-disable jsx-a11y/click-events-have-key-events -- listbox options receive keyboard input
through the owning combobox's aria-activedescendant pattern instead of taking focus themselves */
export function ListboxOption({
  optionRef,
  id,
  className,
  selected,
  active,
  onActivate,
  onActive,
  children,
}: {
  optionRef: (element: HTMLLIElement | null) => void;
  id: string;
  className: string | undefined;
  selected: boolean;
  active: boolean;
  onActivate: () => void;
  onActive: () => void;
  children: ReactNode;
}) {
  return (
    <li
      ref={optionRef}
      id={id}
      role="option"
      className={className}
      aria-selected={selected}
      data-active={active || undefined}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") onActive();
      }}
      onClick={onActivate}
    >
      {children}
    </li>
  );
}
/* oxlint-enable jsx-a11y/click-events-have-key-events */
