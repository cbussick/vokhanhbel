import { describe, expect, it } from "vitest";
import { createWavFixture } from "./audioFixture.test-helper.js";
import { inspectAudio, maximumAudioBytes } from "./inspectAudio.js";

function iosMp4Fixture(): Uint8Array {
  const bytes = new Uint8Array(80);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      bytes[offset + index] = value.charCodeAt(index);
  };

  view.setUint32(0, 20);
  write(4, "ftyp");
  write(8, "M4A ");
  write(20, "mp4a");
  write(28, "mvhd");
  bytes[32] = 0;
  view.setUint32(44, 1_000);
  view.setUint32(48, 7_000);

  return bytes;
}

describe("authoritative audio inspection", () => {
  it("reads an exact seven-second WAV from bytes", async () => {
    await expect(inspectAudio(createWavFixture(7_000), "audio/wav")).resolves.toMatchObject({
      contentType: "audio/wav",
      codec: "pcm",
      durationMs: 7_000,
    });
  });

  it("accepts an iOS-compatible MP4/AAC container", async () => {
    await expect(inspectAudio(iosMp4Fixture(), "audio/mp4")).resolves.toMatchObject({
      contentType: "audio/mp4",
      codec: "aac",
      durationMs: 7_000,
    });
  });

  it("rejects misleading content types, long clips, corrupt bytes, and oversized input", async () => {
    await expect(inspectAudio(createWavFixture(1_000), "audio/mpeg")).rejects.toMatchObject({
      status: 422,
    });
    await expect(inspectAudio(createWavFixture(7_001), "audio/wav")).rejects.toMatchObject({
      status: 422,
    });
    await expect(inspectAudio(new Uint8Array([1, 2, 3]), "audio/mpeg")).rejects.toMatchObject({
      status: 422,
    });
    await expect(inspectAudio(new Uint8Array(maximumAudioBytes + 1))).rejects.toMatchObject({
      status: 413,
    });
  });
});
