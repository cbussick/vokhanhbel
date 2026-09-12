import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders its required text without optional content", () => {
    render(<EmptyState text="Noch nichts hier." />);

    expect(screen.getByText("Noch nichts hier.")).toBeVisible();
  });

  it("renders an optional decorative icon and action", () => {
    const { container } = render(
      <EmptyState
        text="Noch nichts hier."
        icon={<svg data-testid="empty-icon" />}
        action={<button type="button">Etwas hinzufügen</button>}
      />,
    );

    expect(screen.getByTestId("empty-icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Etwas hinzufügen" })).toBeVisible();
    expect(container).toHaveTextContent("Noch nichts hier.");
  });
});
