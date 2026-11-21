import { describe, expect, it } from "vitest";
import { maximumAudioBytes } from "../../contracts/card.js";
import { problemTypes } from "../../contracts/problem.js";
import { createWavFixture } from "./audioFixture.test-helper.js";
import { inspectAudio } from "./inspectAudio.js";

function iosMp4Fixture(): Uint8Array {
  const bytes = new Uint8Array(80);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  };

  view.setUint32(0, 20);
  write(4, "ftyp");
  write(8, "M4A ");
  write(20, "mp4a");
  write(28, "mvhd");
  bytes[32] = 0;
  view.setUint32(44, 1000);
  view.setUint32(48, 7000);

  return bytes;
}

describe("authoritative audio inspection", () => {
  it("rejects truncated WebM scale and duration payloads as invalid audio", async () => {
    const prefix = [0x1a, 0x45, 0xdf, 0xa3, ...new TextEncoder().encode("A_OPUS")];
    const duration = [0x44, 0x89, 0x84, 0x44, 0x7a, 0, 0];
    await expect(
      inspectAudio(new Uint8Array([...prefix, ...duration, 0x2a, 0xd7, 0xb1, 0x88, 1])),
    ).rejects.toMatchObject({ status: 422, type: problemTypes.invalidAudio });
    await expect(
      inspectAudio(new Uint8Array([...prefix, 0x44, 0x89, 0x88, 1])),
    ).rejects.toMatchObject({ status: 422, type: problemTypes.invalidAudio });
  });

  it("rejects truncated Ogg segment tables and page bodies as invalid audio", async () => {
    const bytes = new Uint8Array(36);
    bytes.set(new TextEncoder().encode("OggS"));
    new DataView(bytes.buffer).setBigUint64(6, 48_000n, true);
    bytes[26] = 10;
    bytes.set(new TextEncoder().encode("OpusHead"), 27);
    await expect(inspectAudio(bytes)).rejects.toMatchObject({
      status: 422,
      type: problemTypes.invalidAudio,
    });
    bytes[26] = 1;
    bytes[27] = 20;
    bytes.set(new TextEncoder().encode("OpusHead"), 28);
    await expect(inspectAudio(bytes)).rejects.toMatchObject({
      status: 422,
      type: problemTypes.invalidAudio,
    });
  });
  it("reads an exact seven-second WAV from bytes", async () => {
    await expect(inspectAudio(createWavFixture(7000), "audio/wav")).resolves.toMatchObject({
      contentType: "audio/wav",
      codec: "pcm",
      durationMs: 7000,
    });
  });

  it("accepts an iOS-compatible MP4/AAC container", async () => {
    await expect(inspectAudio(iosMp4Fixture(), "audio/mp4")).resolves.toMatchObject({
      contentType: "audio/mp4",
      codec: "aac",
      durationMs: 7000,
    });
  });

  it("rejects misleading content types, long clips, corrupt bytes, and oversized input", async () => {
    await expect(inspectAudio(createWavFixture(1000), "audio/mpeg")).rejects.toMatchObject({
      status: 422,
    });
    await expect(inspectAudio(createWavFixture(7001), "audio/wav")).rejects.toMatchObject({
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
