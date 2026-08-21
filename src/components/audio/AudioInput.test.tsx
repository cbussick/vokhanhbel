import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n/config";
import { AudioInput } from "./AudioInput";
import { beginPlayback, endPlayback } from "./playbackCoordinator";

const revokeObjectUrl = vi.fn();

class RecorderStub {
  static instances: RecorderStub[] = [];
  static supportedTypes = new Set(["audio/webm;codecs=opus"]);
  static isTypeSupported(type: string) {
    return RecorderStub.supportedTypes.has(type);
  }

  readonly mimeType: string;
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? "";
    RecorderStub.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["recording"], { type: this.mimeType }) } as BlobEvent);
    this.onstop?.();
  }
}

describe("AudioInput microphone gate", () => {
  beforeEach(() => {
    RecorderStub.instances = [];
    RecorderStub.supportedTypes = new Set(["audio/webm;codecs=opus"]);
    vi.stubGlobal("MediaRecorder", RecorderStub);
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:recording") },
      revokeObjectURL: { configurable: true, value: revokeObjectUrl },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests the default microphone only after Record and keeps file import available on denial", async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));

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

  it("selects Opus output, stops manually, releases tracks, and offers Record Again", async () => {
    const stopTracks = [vi.fn(), vi.fn()];
    const getUserMedia = vi
      .fn()
      .mockResolvedValue({ getTracks: () => stopTracks.map((stop) => ({ stop })) });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const onDraftChange = vi.fn();
    const playbackParticipant = { stop: vi.fn() };
    beginPlayback(playbackParticipant);
    const view = render(
      <AudioInput
        face="front"
        draft={null}
        existing={null}
        existingRemoved={false}
        onDraftChange={onDraftChange}
        onExistingRemovedChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Audio aufnehmen" }));
    expect(playbackParticipant.stop).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Aufnahme stoppen" })).toBeVisible();
    expect(RecorderStub.instances[0]?.mimeType).toBe("audio/webm;codecs=opus");
    fireEvent.click(screen.getByRole("button", { name: "Aufnahme stoppen" }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledOnce());
    expect(stopTracks.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    view.rerender(
      <AudioInput
        face="front"
        draft={onDraftChange.mock.calls[0]![0]}
        existing={null}
        existingRemoved={false}
        onDraftChange={onDraftChange}
        onExistingRemovedChange={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Neu aufnehmen" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Audio entfernen" }));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:recording");
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
    endPlayback(playbackParticipant);
  });

  it("stops automatically at seven seconds and cleans up an active recording on unmount", async () => {
    vi.useFakeTimers();
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    const onDraftChange = vi.fn();
    const view = render(
      <AudioInput
        face="back"
        draft={null}
        existing={null}
        existingRemoved={false}
        onDraftChange={onDraftChange}
        onExistingRemovedChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Audio aufnehmen" }));
    await act(async () => Promise.resolve());
    expect(screen.getByRole("button", { name: "Aufnahme stoppen" })).toBeVisible();
    await act(async () => vi.advanceTimersByTime(100));
    expect(screen.getByText(/6\.9 s/)).toBeVisible();
    await act(async () => vi.advanceTimersByTime(6_900));
    await act(async () => Promise.resolve());
    expect(onDraftChange).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();

    view.rerender(
      <AudioInput
        face="back"
        draft={onDraftChange.mock.calls[0]![0]}
        existing={null}
        existingRemoved={false}
        onDraftChange={onDraftChange}
        onExistingRemovedChange={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Neu aufnehmen" }));
    await act(async () => Promise.resolve());
    view.unmount();
    expect(RecorderStub.instances.at(-1)?.state).toBe("inactive");
    expect(stopTrack).toHaveBeenCalledTimes(2);
  });

  it("uses the MP4/AAC fallback when Opus containers are unavailable", async () => {
    RecorderStub.supportedTypes = new Set(["audio/mp4;codecs=mp4a.40.2"]);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
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

    fireEvent.click(screen.getByRole("button", { name: "Audio aufnehmen" }));
    expect(await screen.findByRole("button", { name: "Aufnahme stoppen" })).toBeVisible();
    expect(RecorderStub.instances[0]?.mimeType).toBe("audio/mp4;codecs=mp4a.40.2");
  });
});
revokeObjectUrl.mockReset();
