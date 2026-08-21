import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n/config";
import { AudioInput } from "./AudioInput";

describe("AudioInput microphone gate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the default microphone only after Record and keeps file import available on denial", async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
      },
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(
      <AudioInput
        face="front"
        draft={null}
        existing={null}
        existingRemoved={false}
        onDraftChange={() => undefined}
        onExistingRemovedChange={() => undefined}
      />,
    );

    expect(getUserMedia).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Audio aufnehmen" }));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(await screen.findByText(/Mikrofonzugriff wurde nicht erlaubt/)).toBeVisible();
    expect(screen.getByLabelText(/Audiodatei auswählen/)).toBeEnabled();
  });
});
