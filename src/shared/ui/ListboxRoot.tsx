import { useCallback, useEffect, useRef, type ReactNode } from "react";

export function ListboxRoot({
  rootRef,
  className,
  onFocusLeave,
  children,
}: {
  rootRef: (element: HTMLDivElement | null) => void;
  className: string | undefined;
  onFocusLeave: () => void;
  children: ReactNode;
}) {
  const pointerStartedInside = useRef(false);
  const clearPointerStart = useCallback(() => {
    pointerStartedInside.current = false;
  }, []);

  useEffect(() => {
    const clearAfterMouseRelease = (event: PointerEvent) => {
      if (event.pointerType === "mouse") clearPointerStart();
    };

    window.addEventListener("pointerup", clearAfterMouseRelease, { passive: true });
    window.addEventListener("pointercancel", clearPointerStart, { passive: true });

    return () => {
      window.removeEventListener("pointerup", clearAfterMouseRelease);
      window.removeEventListener("pointercancel", clearPointerStart);
    };
  }, [clearPointerStart]);

  return (
    <div
      ref={rootRef}
      className={className}
      onPointerDownCapture={() => {
        pointerStartedInside.current = true;
      }}
      onClickCapture={() => {
        window.setTimeout(clearPointerStart, 0);
      }}
      onBlur={(event) => {
        if (!pointerStartedInside.current && !event.currentTarget.contains(event.relatedTarget))
          onFocusLeave();
      }}
    >
      {children}
    </div>
  );
}
