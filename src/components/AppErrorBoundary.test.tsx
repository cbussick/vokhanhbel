import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenChild(): never {
  throw new Error("Render failed");
}

describe("AppErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("replaces a failed application tree with a reload action", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Etwas ist schiefgegangen" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Lade die App neu");
    expect(screen.getByRole("button", { name: "App neu laden" })).toBeVisible();
  });
});
