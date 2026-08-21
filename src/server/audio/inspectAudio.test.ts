import { describe, expect, it } from "vitest";
import { inspectAudio, maximumAudioBytes } from "./inspectAudio.js";

function wavFixture(durationMs: number): Uint8Array {
  const sampleRate = 8_000;
  const dataSize = Math.round((sampleRate * durationMs) / 1_000);
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      bytes[offset + index] = value.charCodeAt(index);
  };

  write(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);

  return bytes;
}

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
    await expect(inspectAudio(wavFixture(7_000), "audio/wav")).resolves.toMatchObject({
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
    await expect(inspectAudio(wavFixture(1_000), "audio/mpeg")).rejects.toMatchObject({
      status: 422,
    });
    await expect(inspectAudio(wavFixture(7_001), "audio/wav")).rejects.toMatchObject({
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
