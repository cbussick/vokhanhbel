import { z } from "zod";
import { getR2Environment, type R2Environment } from "../config/environment.js";

export interface AudioObjectRange {
  start: number;
  end?: number;
}

export interface StoredAudioObject {
  bytes: Uint8Array;
  totalSize: number;
  contentRange?: string | undefined;
}

export interface AudioObjectStore {
  put: (objectKey: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  read: (objectKey: string, range?: AudioObjectRange) => Promise<StoredAudioObject | null>;
  delete: (objectKey: string) => Promise<void>;
}

export class InMemoryAudioObjectStore implements AudioObjectStore {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();

  put(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(objectKey, { bytes: bytes.slice(), contentType });

    return Promise.resolve();
  }

  read(objectKey: string, range?: AudioObjectRange): Promise<StoredAudioObject | null> {
    const object = this.objects.get(objectKey);

    if (!object) return Promise.resolve(null);
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? object.bytes.byteLength - 1, object.bytes.byteLength - 1);

    if (start < 0 || start >= object.bytes.byteLength || end < start) return Promise.resolve(null);

    return Promise.resolve({
      bytes: object.bytes.slice(start, end + 1),
      totalSize: object.bytes.byteLength,
      contentRange: range ? `bytes ${start}-${end}/${object.bytes.byteLength}` : undefined,
    });
  }

  delete(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);

    return Promise.resolve();
  }
}

export class FailingAudioObjectStore implements AudioObjectStore {
  readonly delegate: InMemoryAudioObjectStore;
  readonly failures = new Set<keyof AudioObjectStore>();

  constructor(delegate = new InMemoryAudioObjectStore()) {
    this.delegate = delegate;
  }

  private rejectWhenConfigured(operation: keyof AudioObjectStore): void {
    if (this.failures.has(operation)) throw new Error(`Injected audio ${operation} failure`);
  }

  async put(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.rejectWhenConfigured("put");

    await this.delegate.put(objectKey, bytes, contentType);
  }

  async read(objectKey: string, range?: AudioObjectRange): Promise<StoredAudioObject | null> {
    this.rejectWhenConfigured("read");

    return this.delegate.read(objectKey, range);
  }

  async delete(objectKey: string): Promise<void> {
    this.rejectWhenConfigured("delete");

    await this.delegate.delete(objectKey);
  }
}

const encoder = new TextEncoder();
const responseIntegerSchema = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const contentLengthSchema = responseIntegerSchema;
const contentRangeSchema = z
  .string()
  .regex(/^bytes \d+-\d+\/\d+$/u)
  .transform((value, context) => {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(value)!;
    const parsed = z
      .tuple([responseIntegerSchema, responseIntegerSchema, responseIntegerSchema])
      .safeParse(match.slice(1));

    if (!parsed.success) {
      context.addIssue({ code: "custom", message: "Invalid R2 content range integers" });

      return z.NEVER;
    }
    const [start, end, totalSize] = parsed.data;

    if (start > end || end >= totalSize) {
      context.addIssue({ code: "custom", message: "Invalid R2 content range bounds" });

      return z.NEVER;
    }

    return { value, start, end, totalSize };
  });

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === "string" ? encoder.encode(value) : Uint8Array.from(value);

  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const keyBytes = key instanceof Uint8Array ? Uint8Array.from(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

function encodeObjectPath(bucket: string, objectKey: string): string {
  return `/${encodeURIComponent(bucket)}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

export class R2AudioObjectStore implements AudioObjectStore {
  constructor(private readonly configuration: R2Environment = getR2Environment()) {}

  private async request(
    method: "PUT" | "GET" | "DELETE",
    objectKey: string,
    body?: Uint8Array,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const now = new Date();
    const date = now.toISOString().replace(/[:-]|\.\d{3}/gu, "");
    const dateStamp = date.slice(0, 8);
    const path = encodeObjectPath(this.configuration.bucket, objectKey);
    const host = new URL(this.configuration.endpoint).host;
    const payloadHash = await sha256(body ?? new Uint8Array());
    const headers = new Headers({
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": date,
      ...extraHeaders,
    });
    const signedHeaderNames = [...headers.keys()].sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name.toLowerCase()}:${headers.get(name)!.trim()}\n`)
      .join("");
    const signedHeaders = signedHeaderNames.map((name) => name.toLowerCase()).join(";");
    const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join(
      "\n",
    );
    const scope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", date, scope, await sha256(canonicalRequest)].join(
      "\n",
    );
    const dateKey = await hmac(
      encoder.encode(`AWS4${this.configuration.secretAccessKey}`),
      dateStamp,
    );
    const regionKey = await hmac(dateKey, "auto");
    const serviceKey = await hmac(regionKey, "s3");
    const signingKey = await hmac(serviceKey, "aws4_request");
    const signature = toHex(await hmac(signingKey, stringToSign));
    headers.set(
      "Authorization",
      `AWS4-HMAC-SHA256 Credential=${this.configuration.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    );

    return fetch(`${this.configuration.endpoint}${path}`, {
      method,
      headers,
      ...(body ? { body: new Blob([Uint8Array.from(body)]) } : {}),
    });
  }

  async put(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const response = await this.request("PUT", objectKey, bytes, { "content-type": contentType });

    if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
  }

  async read(objectKey: string, range?: AudioObjectRange): Promise<StoredAudioObject | null> {
    const rangeHeader = range ? { range: `bytes=${range.start}-${range.end ?? ""}` } : {};
    const response = await this.request("GET", objectKey, undefined, rangeHeader);

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`R2 read failed (${response.status})`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentRangeHeader = response.headers.get("content-range");
    const contentRange = contentRangeHeader
      ? contentRangeSchema.parse(contentRangeHeader)
      : undefined;
    const contentLength = contentLengthSchema.parse(
      response.headers.get("content-length") ?? bytes.byteLength,
    );

    if (contentLength !== bytes.byteLength)
      throw new Error("R2 returned an invalid content length");
    if (
      contentRange &&
      (contentRange.end - contentRange.start + 1 !== bytes.byteLength ||
        contentRange.start !== range?.start ||
        (range?.end !== undefined && contentRange.end > range.end))
    )
      throw new Error("R2 returned an unexpected content range");
    const totalSize = contentRange?.totalSize ?? contentLength;

    return {
      bytes,
      totalSize,
      ...(contentRange ? { contentRange: contentRange.value } : {}),
    };
  }

  async delete(objectKey: string): Promise<void> {
    const response = await this.request("DELETE", objectKey);

    if (!response.ok && response.status !== 404)
      throw new Error(`R2 deletion failed (${response.status})`);
  }
}

let audioObjectStore: AudioObjectStore | undefined;

export function getAudioObjectStore(): AudioObjectStore {
  audioObjectStore ??= new R2AudioObjectStore();

  return audioObjectStore;
}

export function setAudioObjectStoreForTests(store: AudioObjectStore | undefined): void {
  audioObjectStore = store;
}
