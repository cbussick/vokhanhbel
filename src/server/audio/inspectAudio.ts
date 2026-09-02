import { maximumAudioBytes, maximumAudioDurationMs } from "../../contracts/card.js";
import { problemTypes } from "../../contracts/problem.js";
import { AppProblem } from "../http/problem.js";

export interface InspectedAudio {
  contentType: "audio/mpeg" | "audio/mp4" | "audio/webm" | "audio/ogg" | "audio/wav";
  codec: string;
  byteSize: number;
  durationMs: number;
  checksum: string;
}

function audioProblem(detail: string): AppProblem {
  return new AppProblem(422, problemTypes.invalidAudio, "Audiodatei prüfen", detail);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function inspectWav(bytes: Uint8Array): Omit<InspectedAudio, "byteSize" | "checksum"> | null {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  let format = 0;

  while (offset + 8 <= bytes.byteLength) {
    const chunk = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);

    if (chunk === "fmt " && size >= 16 && offset + 24 <= bytes.byteLength) {
      format = view.getUint16(offset + 8, true);
      byteRate = view.getUint32(offset + 16, true);
    }
    if (chunk === "data") dataSize = Math.min(size, bytes.byteLength - offset - 8);
    offset += 8 + size + (size % 2);
  }

  if (![1, 3].includes(format) || byteRate <= 0 || dataSize <= 0)
    throw audioProblem("WAV ist beschädigt");

  return {
    contentType: "audio/wav",
    codec: format === 1 ? "pcm" : "ieee-float",
    durationMs: Math.max(1, Math.round((dataSize / byteRate) * 1_000)),
  };
}

function inspectMp4(bytes: Uint8Array): Omit<InspectedAudio, "byteSize" | "checksum"> | null {
  if (ascii(bytes, 4, 4) !== "ftyp") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = ascii(bytes, 0, bytes.byteLength);

  if (!text.includes("mp4a")) throw audioProblem("MP4 enthält kein AAC-Audio");
  const typeOffset = text.indexOf("mvhd");

  if (typeOffset < 0 || typeOffset + 32 > bytes.byteLength)
    throw audioProblem("MP4 ist beschädigt");
  const version = bytes[typeOffset + 4];
  const timescaleOffset = typeOffset + (version === 1 ? 24 : 16);
  const durationOffset = timescaleOffset + 4;
  const timescale = view.getUint32(timescaleOffset);
  const duration =
    version === 1 ? Number(view.getBigUint64(durationOffset)) : view.getUint32(durationOffset);

  if (!timescale || !duration) throw audioProblem("MP4 hat keine gültige Dauer");

  return {
    contentType: "audio/mp4",
    codec: "aac",
    durationMs: Math.max(1, Math.round((duration / timescale) * 1_000)),
  };
}

function readEbmlNumber(
  bytes: Uint8Array,
  offset: number,
): { value: number; length: number } | null {
  const first = bytes[offset];

  if (!first) return null;
  let mask = 0x80;
  let length = 1;

  while (length <= 8 && !(first & mask)) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > bytes.byteLength) return null;
  let value = first & (mask - 1);

  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index]!;

  return { value, length };
}

function findBytes(bytes: Uint8Array, target: number[]): number {
  outer: for (let offset = 0; offset <= bytes.byteLength - target.length; offset += 1) {
    for (let index = 0; index < target.length; index += 1) {
      if (bytes[offset + index] !== target[index]) continue outer;
    }

    return offset;
  }

  return -1;
}

function inspectWebm(bytes: Uint8Array): Omit<InspectedAudio, "byteSize" | "checksum"> | null {
  if (findBytes(bytes.slice(0, 4), [0x1a, 0x45, 0xdf, 0xa3]) !== 0) return null;
  if (!ascii(bytes, 0, bytes.byteLength).includes("A_OPUS"))
    throw audioProblem("WebM enthält kein Opus-Audio");
  const scaleId = findBytes(bytes, [0x2a, 0xd7, 0xb1]);
  const durationId = findBytes(bytes, [0x44, 0x89]);
  let timecodeScale = 1_000_000;

  if (scaleId >= 0) {
    const size = readEbmlNumber(bytes, scaleId + 3);

    if (size && size.value > 0 && size.value <= 8) {
      timecodeScale = 0;
      for (let index = 0; index < size.value; index += 1)
        timecodeScale = timecodeScale * 256 + bytes[scaleId + 3 + size.length + index]!;
    }
  }
  const size = durationId >= 0 ? readEbmlNumber(bytes, durationId + 2) : null;

  if (!size || ![4, 8].includes(size.value)) throw audioProblem("WebM hat keine gültige Dauer");
  const start = durationId + 2 + size.length;
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, size.value);
  const duration = size.value === 4 ? view.getFloat32(0) : view.getFloat64(0);

  if (!Number.isFinite(duration) || duration <= 0)
    throw audioProblem("WebM hat keine gültige Dauer");

  return {
    contentType: "audio/webm",
    codec: "opus",
    durationMs: Math.max(1, Math.round((duration * timecodeScale) / 1_000_000)),
  };
}

function inspectOgg(bytes: Uint8Array): Omit<InspectedAudio, "byteSize" | "checksum"> | null {
  if (ascii(bytes, 0, 4) !== "OggS") return null;
  if (!ascii(bytes, 0, Math.min(bytes.byteLength, 256)).includes("OpusHead"))
    throw audioProblem("Ogg enthält kein Opus-Audio");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let lastGranule = 0n;

  while (offset + 27 <= bytes.byteLength && ascii(bytes, offset, 4) === "OggS") {
    lastGranule = view.getBigUint64(offset + 6, true);
    const segmentCount = bytes[offset + 26]!;
    let pageSize = 27 + segmentCount;

    for (let index = 0; index < segmentCount; index += 1) pageSize += bytes[offset + 27 + index]!;
    offset += pageSize;
  }

  if (lastGranule <= 0n) throw audioProblem("Ogg hat keine gültige Dauer");

  return {
    contentType: "audio/ogg",
    codec: "opus",
    durationMs: Math.max(1, Math.round((Number(lastGranule) / 48_000) * 1_000)),
  };
}

function inspectMp3(bytes: Uint8Array): Omit<InspectedAudio, "byteSize" | "checksum"> | null {
  let offset = 0;

  if (ascii(bytes, 0, 3) === "ID3" && bytes.byteLength >= 10) {
    offset =
      10 +
      ((bytes[6]! & 0x7f) << 21) +
      ((bytes[7]! & 0x7f) << 14) +
      ((bytes[8]! & 0x7f) << 7) +
      (bytes[9]! & 0x7f);
  }
  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] === 0xff && (bytes[offset + 1]! & 0xe0) === 0xe0) break;
    offset += 1;
  }
  if (offset + 4 > bytes.byteLength) return null;
  const versionBits = (bytes[offset + 1]! >> 3) & 0x03;
  const layerBits = (bytes[offset + 1]! >> 1) & 0x03;
  const bitrateIndex = (bytes[offset + 2]! >> 4) & 0x0f;
  const sampleRateIndex = (bytes[offset + 2]! >> 2) & 0x03;
  const mpeg1Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const mpeg2Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

  if (layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3)
    throw audioProblem("MP3 ist beschädigt oder nicht unterstützt");
  const bitrate =
    (versionBits === 3 ? mpeg1Bitrates[bitrateIndex] : mpeg2Bitrates[bitrateIndex])! * 1_000;

  return {
    contentType: "audio/mpeg",
    codec: "mp3",
    durationMs: Math.max(1, Math.round(((bytes.byteLength - offset) * 8 * 1_000) / bitrate)),
  };
}

export async function inspectAudio(
  bytes: Uint8Array,
  suppliedContentType?: string,
): Promise<InspectedAudio> {
  if (bytes.byteLength === 0) throw audioProblem("Die Audiodatei ist leer");
  if (bytes.byteLength > maximumAudioBytes)
    throw new AppProblem(413, problemTypes.requestTooLarge, "Audiodatei ist zu groß");
  const detected =
    inspectWav(bytes) ??
    inspectMp4(bytes) ??
    inspectWebm(bytes) ??
    inspectOgg(bytes) ??
    inspectMp3(bytes);

  if (!detected) throw audioProblem("Audioformat wird nicht unterstützt");
  const normalizedSuppliedType = suppliedContentType?.split(";", 1)[0]?.trim().toLowerCase();

  if (normalizedSuppliedType && normalizedSuppliedType !== detected.contentType)
    throw audioProblem("Dateityp stimmt nicht mit dem Inhalt überein");
  if (detected.durationMs > maximumAudioDurationMs)
    throw audioProblem("Audio ist länger als 7 Sekunden");
  const checksumBytes = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  const checksum = [...new Uint8Array(checksumBytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return { ...detected, byteSize: bytes.byteLength, checksum };
}
