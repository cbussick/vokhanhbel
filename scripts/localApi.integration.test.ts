import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer as createPortServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { localDevelopmentPlugin, type DevelopmentDeployment } from "./localApi.js";

const repository = process.cwd();
const deployment = JSON.parse(
  readFileSync(resolve(repository, "vercel.json"), "utf8"),
) as DevelopmentDeployment;
const fixtureRoot = mkdtempSync(resolve(tmpdir(), "vok-local-api-"));
const servers: ViteDevServer[] = [];

function fixture(path: string, source: string): void {
  const file = resolve(fixtureRoot, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
}

async function start(
  root: string,
  fullstack: boolean,
): Promise<{ server: ViteDevServer; url: string }> {
  const port = await new Promise<number>((resolvePort, reject) => {
    const socket = createPortServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      if (!address || typeof address === "string") throw new Error("Missing port");
      socket.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
  const server = await createServer({
    root,
    configFile: root === repository ? resolve(repository, "vite.config.ts") : false,
    mode: fullstack ? "local-fullstack" : "development",
    logLevel: "silent",
    plugins: root === repository ? [] : [localDevelopmentPlugin(deployment, fullstack)],
    server: { port, watch: { usePolling: false } },
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Missing HTTP address");

  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function raw(
  url: string,
  path: string,
  host?: string,
): Promise<{ status: number; body: string; cookies: string[] }> {
  return new Promise((resolveResponse, reject) => {
    const request = httpRequest(url, { path, headers: host ? { Host: host } : {} }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.once("end", () =>
        resolveResponse({
          status: response.statusCode!,
          body: Buffer.concat(chunks).toString(),
          cookies: response.headers["set-cookie"] ?? [],
        }),
      );
    });
    request.once("error", reject);
    request.end();
  });
}

beforeAll(() => {
  fixture(
    "index.html",
    '<html><head></head><body>fixture page<script type="module" src="/src/main.js"></script></body></html>',
  );
  fixture(
    "src/main.js",
    'export const client = "browser-only"; if (import.meta.hot) import.meta.hot.accept();',
  );
  fixture("src/server/value.ts", 'export const value = "initial dependency";');
  fixture(
    "api/transitive.ts",
    'import { value } from "../src/server/value.js"; export function GET() { return new Response(value); }',
  );
  fixture("src/server/private.ts", 'export const secret = "SERVER_SOURCE_CANARY";');
  fixture("src/leak.js", 'import { secret } from "./server/private.ts"; console.log(secret);');
  symlinkSync(
    resolve(fixtureRoot, "src/server/private.ts"),
    resolve(fixtureRoot, "src/disguised.js"),
  );
  fixture(".env.local", "PRIVATE_CREDENTIAL_CANARY=never-send\n");
  fixture("Dockerfile", "PRIVATE_DOCKERFILE_CANARY");
  fixture("public/asset.svg", "<svg></svg>");
  fixture("public/nested/asset.svg", "<svg>nested</svg>");
  fixture("src/client/.private.ts", 'export const secret = "PRIVATE_CREDENTIAL_CANARY";');
  fixture(
    "api/explicit.ts",
    'export function HEAD() { return new Response(null, { status: 202, headers: { "X-Explicit": "yes" } }); }',
  );
  fixture("api/invalid.ts", 'export function GET() { return { secret: "PRIVATE_ERROR_CANARY" }; }');
  fixture(
    "api/transport/index.ts",
    `
let controller;
let resolveAbort;
export const aborted = new Promise((resolve) => { resolveAbort = resolve; });
export function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.has('stream')) {
    request.signal.addEventListener('abort', () => resolveAbort('aborted'), { once: true });
    return new Response(new ReadableStream({
      start(value) { controller = value; value.enqueue(new TextEncoder().encode('first\\n')); },
      cancel() { resolveAbort('cancelled'); }
    }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', 'first=one; HttpOnly; Path=/');
  headers.append('Set-Cookie', 'second=two; HttpOnly; Path=/');
  return new Response(JSON.stringify({ url: request.url, cookie: request.headers.get('cookie'), method: request.method }), { headers });
}
export async function POST(request) {
  if (new URL(request.url).searchParams.has('release')) {
    controller.enqueue(new TextEncoder().encode('second\\n')); controller.close();
    return new Response(null, { status: 204 });
  }
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    const data = await request.formData();
    return Response.json({ text: data.get('text'), file: Array.from(new Uint8Array(await data.get('file').arrayBuffer())) });
  }
  return new Response(request.body, { headers: { 'Content-Type': 'application/octet-stream' } });
}
export function PATCH() { throw new Error('PRIVATE_ERROR_CANARY'); }
export function DELETE() { return new Response(null, { status: 204 }); }
`,
  );
  fixture(
    "api/cards/[cardId].ts",
    "export function GET(request) { return Response.json({ pathname: new URL(request.url).pathname }); }",
  );
  fixture("api/cards/fixed.ts", "export function GET() { return new Response('static wins'); }");
  fixture(
    "api/topics/index.ts",
    "export function GET(request) { const params = new URL(request.url).searchParams; return Response.json({ topicId: params.get('topicId'), extra: params.getAll('extra') }); }",
  );
  fixture(
    "api/audio/index.ts",
    "export function POST(request) { return Response.json(Object.fromEntries(new URL(request.url).searchParams)); }",
  );
});

afterAll(async () => {
  await Promise.all(servers.map((server) => server.close()));
  rmSync(fixtureRoot, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("local API real HTTP transport", () => {
  let url: string;
  let server: ViteDevServer;
  beforeAll(async () => {
    ({ url, server } = await start(fixtureRoot, true));
  });

  it("preserves duplicate cookies, incoming cookies, queries, HEAD and method errors", async () => {
    expect((await raw(url, "/api/transport")).cookies).toEqual([
      "first=one; HttpOnly; Path=/",
      "second=two; HttpOnly; Path=/",
    ]);
    const response = await fetch(`${url}/api/transport?a=one&a=two`, {
      headers: { Cookie: "a=1; b=2" },
    });
    expect(await response.json()).toEqual({
      url: `${url}/api/transport?a=one&a=two`,
      cookie: "a=1; b=2",
      method: "GET",
    });
    const head = await fetch(`${url}/api/transport`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.getSetCookie()).toHaveLength(2);
    expect(await head.text()).toBe("");
    const explicit = await fetch(`${url}/api/explicit`, { method: "HEAD" });
    expect(explicit.status).toBe(202);
    expect(explicit.headers.get("x-explicit")).toBe("yes");
    expect(await explicit.text()).toBe("");
    const unsupported = await fetch(`${url}/api/transport`, { method: "PUT" });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("allow")).toBe("GET, HEAD, POST, PATCH, DELETE");
    expect((await fetch(`${url}/api/transport`, { method: "DELETE" })).status).toBe(204);
  });

  it("uses static precedence, original dynamic paths and committed rewrite query precedence", async () => {
    expect(await (await fetch(`${url}/api/cards/fixed`)).text()).toBe("static wins");
    expect(await (await fetch(`${url}/api/cards/abc?extra=1`)).json()).toEqual({
      pathname: "/api/cards/abc",
    });
    expect(
      await (await fetch(`${url}/api/topics/path-id?topicId=wrong&extra=yes&extra=again`)).json(),
    ).toEqual({ topicId: "path-id", extra: ["yes", "again"] });
    expect(
      await (
        await fetch(`${url}/api/pronunciations?pronunciation=wrong&extra=yes`, { method: "POST" })
      ).json(),
    ).toEqual({ pronunciation: "1", extra: "yes" });
    expect((await fetch(`${url}/api/topics/one/two`)).status).toBe(404);
    expect((await fetch(`${url}/api/missing`)).status).toBe(404);
    expect((await fetch(`${url}/api`)).status).toBe(404);
    expect((await fetch(`${url}/api/pronunciations`)).status).toBe(405);
  });

  it("passes binary, chunked and multipart request bodies without text conversion", async () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    const binary = await fetch(`${url}/api/transport`, { method: "POST", body: bytes });
    expect(new Uint8Array(await binary.arrayBuffer())).toEqual(bytes);
    const multipart = new FormData();
    multipart.set("text", "chào");
    multipart.set("file", new Blob([bytes]), "clip.webm");
    expect(
      await (await fetch(`${url}/api/transport`, { method: "POST", body: multipart })).json(),
    ).toEqual({ text: "chào", file: Array.from(bytes) });
    await new Promise<void>((resolveRequest, reject) => {
      const request = httpRequest(`${url}/api/transport`, { method: "POST" }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          expect(Buffer.concat(chunks)).toEqual(Buffer.from(bytes));
          resolveRequest();
        });
      });
      request.on("error", reject);
      request.write(bytes.slice(0, 2));
      request.end(bytes.slice(2));
    });
  });

  it("delivers a stream before completion and propagates client disconnect", async () => {
    const streamed = await fetch(`${url}/api/transport?stream=1`);
    const reader = streamed.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("first\n");
    expect((await fetch(`${url}/api/transport?release=1`, { method: "POST" })).status).toBe(204);
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("second\n");
    expect((await reader.read()).done).toBe(true);
    const abort = new AbortController();
    const disconnected = await fetch(`${url}/api/transport?stream=1`, { signal: abort.signal });
    const disconnectedReader = disconnected.body!.getReader();
    await disconnectedReader.read();
    const module = await server.ssrLoadModule(resolve(fixtureRoot, "api/transport/index.ts"));
    abort.abort();
    expect(["aborted", "cancelled"]).toContain(await module.aborted);
  });

  it("returns only a safe error and keeps security headers without production CSP changes", async () => {
    const response = await fetch(`${url}/api/transport`, { method: "PATCH" });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Local API request failed.");
    const invalid = await fetch(`${url}/api/invalid`);
    expect(invalid.status).toBe(500);
    expect(await invalid.text()).toBe("Local API request failed.");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("ws://127.0.0.1:*");
    expect(deployment.headers[0]!.headers[0]!.value).not.toContain("unsafe-inline");
  });

  it("keeps frontend serving and frontend HMR while reloading changed API modules", async () => {
    const page = await fetch(`${url}/collections`);
    expect(await page.text()).toContain("/@vite/client");
    expect(await (await fetch(`${url}/src/main.js`)).text()).toContain("browser-only");
    expect((await fetch(`${url}/@vite/client`)).status).toBe(200);
    expect((await fetch(`${url}/node_modules/vite/dist/client/env.mjs`)).status).toBe(200);
    expect(await (await fetch(`${url}/asset.svg`)).text()).toBe("<svg></svg>");
    expect(await (await fetch(`${url}/nested/asset.svg`)).text()).toBe("<svg>nested</svg>");
    const socket = new WebSocket(
      `${url.replace("http:", "ws:")}/?token=${server.config.webSocketToken}`,
      "vite-hmr",
    );
    const message = (type: string) =>
      new Promise<void>((resolveMessage) => {
        const onMessage = (event: MessageEvent) => {
          const payload: unknown = JSON.parse(String(event.data));
          if (
            typeof payload === "object" &&
            payload !== null &&
            "type" in payload &&
            payload.type === type
          ) {
            socket.removeEventListener("message", onMessage);
            resolveMessage();
          }
        };
        socket.addEventListener("message", onMessage);
      });
    await message("connected");
    const frontendUpdate = message("update");
    fixture(
      "src/main.js",
      'export const client = "updated browser"; if (import.meta.hot) import.meta.hot.accept();',
    );
    await frontendUpdate;
    expect(await (await fetch(`${url}/src/main.js`)).text()).toContain("updated browser");
    const backendUpdate = message("full-reload");
    // Wait for the real watcher and WebSocket, not a sleep or manual module-graph invalidation.
    const file = resolve(fixtureRoot, "api/cards/fixed.ts");
    const changed = new Promise<void>((resolveChange) => {
      const onChange = (path: string) => {
        if (path === file) {
          server.watcher.off("change", onChange);
          resolveChange();
        }
      };
      server.watcher.on("change", onChange);
    });
    writeFileSync(file, "export function GET() { return new Response('updated backend'); }");
    await changed;
    await backendUpdate;
    expect(await (await fetch(`${url}/api/cards/fixed`)).text()).toBe("updated backend");
    expect(await (await fetch(`${url}/api/transitive`)).text()).toBe("initial dependency");
    const dependencyUpdate = message("full-reload");
    fixture("src/server/value.ts", 'export const value = "updated dependency";');
    await dependencyUpdate;
    expect(await (await fetch(`${url}/api/transitive`)).text()).toBe("updated dependency");
    socket.close();
  });

  it.each([
    "/api/transport/index.ts",
    "/api/transport/index.ts?raw",
    "/api/cards/[cardId].ts",
    "/api/%2e%2e/.env.local",
    "/api/../.env.local",
    "/api/%252e%252e/session",
    "/api%5csession",
    "/api//transport",
    "/api/transport%00",
    "/src/server/private.ts",
    "/src/server/private.ts?raw",
    "/src/client/.private.ts?raw",
    "/src/server/private.ts.map",
    "/src%2fserver/private.ts",
    "/@fs/etc/passwd",
    "/@fs%2fetc/passwd",
    `/@fs${repository}/.env.local`,
    "/@id/__x00__server",
    "/node_modules/@hono/node-server/dist/index.mjs",
    "/scripts/localApi.ts",
    "/.env.local",
    "/vercel.json",
    "/package.json",
    "/__open-in-editor?file=/etc/passwd",
  ])("does not expose API source or filesystem via %s", async (path) => {
    const response = await raw(url, path);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).not.toMatch(
      /SERVER_SOURCE_CANARY|PRIVATE_CREDENTIAL_CANARY|export function|root:x:/,
    );
  });

  it("keeps server-only imports and symlinks out of the client module graph", async () => {
    const response = await fetch(`${url}/src/leak.js`);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("SERVER_SOURCE_CANARY");
    expect(
      server.environments.client.moduleGraph.getModuleById(
        resolve(fixtureRoot, "src/server/private.ts"),
      ),
    ).toBeUndefined();
    expect((await fetch(`${url}/src/disguised.js?raw`)).status).toBe(404);
    // Replacing a previously public asset with a server-source symlink must not open a bypass.
    rmSync(resolve(fixtureRoot, "public/asset.svg"));
    symlinkSync(
      resolve(fixtureRoot, "src/server/private.ts"),
      resolve(fixtureRoot, "public/asset.svg"),
    );
    expect((await fetch(`${url}/asset.svg`)).status).toBe(404);
  });

  it("does not serve extensionless repository files or accept foreign hosts", async () => {
    expect((await raw(url, "/Dockerfile")).body).not.toContain("PRIVATE_DOCKERFILE_CANARY");
    for (const host of ["evil.example", "evil.localhost", "192.0.2.1", "localhost:1"]) {
      expect((await raw(url, "/api/transport", host)).status).toBe(403);
    }
  });
});

describe("real application handlers without credentials or database", () => {
  let url: string;
  beforeAll(async () => {
    vi.stubEnv("APP_PASSWORD_HASH", "unused-test-hash");
    vi.stubEnv("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:1/unused");
    vi.stubEnv("OPENAI_API_KEY", "unused-test-key");
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", "local-api-test-secret-never-for-production");
    vi.stubEnv("CRON_SECRET", undefined);
    ({ url } = await start(repository, true));
  });

  it("serves the actual frontend module graph without exposing server modules", async () => {
    const pending = ["/src/main.tsx"];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const path = pending.pop()!;
      if (visited.has(path)) continue;
      visited.add(path);
      const response = await fetch(`${url}${path}`);
      expect(response.status, path).toBe(200);
      const source = await response.text();
      expect(source).not.toContain("unused-test-key");
      for (const match of source.matchAll(
        /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\/[^/][^"']*)["']/g,
      )) {
        pending.push(match[1]!);
      }
    }
    expect(visited.has("/src/main.tsx")).toBe(true);
    expect(visited.size).toBeGreaterThan(10);
    const server = servers.find((entry) => entry.config.root === repository)!;
    expect(
      [...server.environments.client.moduleGraph.idToModuleMap.keys()].some(
        (id) => id.includes("/src/server/") || id.includes("/api/"),
      ),
    ).toBe(false);
  });

  it("loads the actual .js-to-.ts handler graph and reports an anonymous Session", async () => {
    const response = await fetch(`${url}/api/session`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
    expect(response.headers.get("x-request-id")).toMatch(/^[\da-f-]{36}$/);
  });

  it("preserves Origin/CSRF checks, protected resource guards and methods", async () => {
    for (const path of [
      "session",
      "audio",
      "pronunciations",
      "topics/topic-id",
      "cards/card-id",
      "collections/collection-id",
      "reviews",
      "tutor-replies",
    ]) {
      const response = await fetch(`${url}/api/${path}`, {
        method: path.includes("-id") ? "DELETE" : "POST",
        headers: { Origin: "https://foreign.example" },
      });
      expect(response.status).toBe(403);
    }
    const origin = await fetch(`${url}/api/session`, {
      method: "POST",
      headers: { Origin: url, "Sec-Fetch-Site": "cross-site" },
    });
    expect(origin.status).toBe(403);
    const malformed = await fetch(`${url}/api/session`, {
      method: "POST",
      headers: { Origin: url, "Content-Type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    for (const path of ["cards", "cards/abc", "collections", "topics", "stats", "audio/abc"]) {
      const response = await fetch(`${url}/api/${path}`, {
        headers: { "Sec-Fetch-Site": "same-origin" },
      });
      expect(response.status).toBe(401);
    }
    const collection = await fetch(`${url}/api/collections/abc`);
    expect(collection.status).toBe(405);
    expect(collection.headers.get("allow")).toBe("PATCH, DELETE");
    const cleanup = await fetch(`${url}/api/internal/audio-cleanup`);
    expect(cleanup.status).toBe(401);
  });
});

describe("frontend-only mode", () => {
  it("does not enable backend dispatch and still protects server source", async () => {
    const { url } = await start(fixtureRoot, false);
    expect((await fetch(`${url}/api/transport`)).status).toBe(404);
    expect((await fetch(`${url}/src/server/private.ts`)).status).toBe(404);
    expect(await (await fetch(`${url}/`)).text()).toContain("fixture page");
  });
});
