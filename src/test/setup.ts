import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { mockServer } from "./server";

// Testing Library defaults `findBy`/`waitFor` to one second, which is not enough for this app: a
// test that clicks through to another route waits on that route's lazy chunk, its loader and its
// MSW-backed queries, and on a loaded machine that overruns a second. It failed as an empty document
// — the assertion arriving before anything had rendered — which reads like a broken selector rather
// than a slow one, and cost two wrong diagnoses before CI made it reproducible. `renderApp` already
// hand-rolls a longer wait for the first render; this covers every navigation after it.
configure({ asyncUtilTimeout: 5_000 });

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
Object.defineProperty(window, "scrollTo", { writable: true, value: () => undefined });

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  mockServer.resetHandlers();
  // Each test starts like a fresh browser — otherwise one test's Swipe/matching alternation
  // preference (see browserState.ts) would leak into the next.
  window.localStorage.clear();
});
afterAll(() => mockServer.close());
