import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n/config";
import { AudioPlayer } from "./AudioPlayer";

const firstAudio = {
  id: "11111111-1111-4111-8111-111111111111",
  durationMs: 2_000,
  contentType: "audio/wav" as const,
  byteSize: 1_000,
};
const secondAudio = { ...firstAudio, id: "22222222-2222-4222-8222-222222222222" };

describe("AudioPlayer", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      fireEvent.playing(this);

      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      fireEvent.pause(this);
    });
  });

  it("loads only on Play and pauses the previous application player", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    const user = userEvent.setup();
    render(
      <>
        <AudioPlayer audio={firstAudio} label="Audio Vorderseite" />
        <AudioPlayer audio={secondAudio} label="Audio Rückseite" />
      </>,
    );
    const elements = document.querySelectorAll("audio");

    expect(elements[0]).not.toHaveAttribute("src");
    await user.click(screen.getByRole("button", { name: "Audio Vorderseite: Abspielen" }));
    expect(elements[0]).toHaveAttribute("src", `/api/audio/${firstAudio.id}`);
    await user.click(screen.getByRole("button", { name: "Audio Rückseite: Abspielen" }));
    expect(pause).toHaveBeenCalled();
  });

  it("offers Replay after a clip ends", async () => {
    const user = userEvent.setup();
    render(<AudioPlayer audio={firstAudio} label="Audio Vorderseite" />);
    const element = document.querySelector("audio")!;

    await user.click(screen.getByRole("button", { name: "Audio Vorderseite: Abspielen" }));
    fireEvent.ended(element);
    expect(screen.getByRole("button", { name: "Audio Vorderseite: Wiederholen" })).toBeVisible();
  });
});
