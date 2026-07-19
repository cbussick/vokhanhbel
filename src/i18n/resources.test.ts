import { describe, expect, it } from "vitest";
import { i18n } from "./config";

describe("German error-message plurals", () => {
  it("uses singular grammar for one affected review", () => {
    expect(i18n.t("shell.logoutPending", { count: 1 })).toBe(
      "1 Bewertung ist noch nicht gespeichert. Trotzdem abmelden?",
    );
    expect(i18n.t("connectivity.offlinePending", { count: 1 })).toBe(
      "Offline · 1 Bewertung wartet. Lass die App geöffnet.",
    );
    expect(i18n.t("connectivity.failed", { count: 1 })).toBe(
      "1 Bewertung konnte noch nicht gespeichert werden.",
    );
  });

  it("uses singular grammar for a one-second Login cooldown", () => {
    expect(i18n.t("login.throttled", { count: 1 })).toBe(
      "Zu viele Versuche. Du kannst es in einer Sekunde wieder versuchen.",
    );
  });
});
