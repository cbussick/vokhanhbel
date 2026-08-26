import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListboxRoot } from "./ListboxRoot";

describe("ListboxRoot", () => {
  it("clears its focus guard when a mouse drag ends outside", () => {
    const onFocusLeave = vi.fn();
    render(
      <>
        <ListboxRoot rootRef={() => undefined} className={undefined} onFocusLeave={onFocusLeave}>
          <button type="button">Trigger</button>
        </ListboxRoot>
        <button type="button">Outside</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    const outside = screen.getByRole("button", { name: "Outside" });
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    fireEvent.pointerUp(outside, { pointerType: "mouse" });
    fireEvent.blur(trigger, { relatedTarget: outside });

    expect(onFocusLeave).toHaveBeenCalledOnce();
  });
});
