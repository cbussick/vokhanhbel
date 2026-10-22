import { existsSync, globSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getRequestListener } from "@hono/node-server";
import { normalizePath, type Plugin, type ViteDevServer } from "vite";
import { z } from "zod";

export interface DevelopmentDeployment {
  headers: { source: string; headers: { key: string; value: string }[] }[];
  rewrites: { source: string; destination: string }[];
}

interface ApiRoute {
  segments: string[];
  file: string;
}

const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
type ApiHandler = (request: Request) => Response | Promise<Response>;
// The callable signature is the application contract; the returned Response is checked separately.
const apiHandlerSchema = z.custom<ApiHandler>((value) => typeof value === "function").optional();
const apiModuleSchema = z.object({
  GET: apiHandlerSchema,
  HEAD: apiHandlerSchema,
  POST: apiHandlerSchema,
  PUT: apiHandlerSchema,
  PATCH: apiHandlerSchema,
  DELETE: apiHandlerSchema,
  OPTIONS: apiHandlerSchema,
});
const viteClientFiles = ["../client/client.mjs", "../client/env.mjs"].map((file) =>
  normalizePath(fileURLToPath(new URL(file, import.meta.resolve("vite")))),
);
const serverDirectories = ["api", "scripts", "src/server", "src/test", "tests", "tools"];

function isWithin(file: string, directory: string): boolean {
  const path = relative(directory, file);

  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function isServerFile(file: string, root: string): boolean {
  return serverDirectories.some((directory) => isWithin(file, resolve(root, directory)));
}

function browserFile(file: string, root: string): boolean {
  const normalizedFile = normalizePath(file);
  if (
    viteClientFiles.includes(normalizedFile) ||
    isWithin(file, resolve(root, "node_modules/.vite/deps"))
  )
    return true;
  if (
    isServerFile(file, root) ||
    /(?:^|\/)\.[^/]|\.test\.[^/]+$/.test(normalizePath(relative(root, file)))
  )
    return false;

  return (
    normalizedFile === normalizePath(resolve(root, "index.html")) ||
    ["src", "public", "node_modules"].some((directory) => isWithin(file, resolve(root, directory)))
  );
}

function apiRoutes(root: string): ApiRoute[] {
  return globSync("**/*.ts", { cwd: resolve(root, "api") })
    .map((file) => {
      const segments = normalizePath(file).replace(/\.ts$/, "").split("/");
      if (segments.at(-1) === "index") segments.pop();
      if (!segments.every((segment) => /^(?:[\w-]+|\[\w+\])$/.test(segment))) {
        throw new Error("Unsupported local API entry point.");
      }

      return {
        segments: ["api", ...segments],
        file: normalizePath(resolve(root, "api", file)),
      };
    })
    .sort((first, second) => {
      const dynamicCount = (route: ApiRoute) =>
        route.segments.filter((segment) => segment.startsWith("[")).length;

      return dynamicCount(first) - dynamicCount(second);
    });
}

function matches(segments: string[], pathname: string, dynamicPrefix: string): boolean {
  const parts = pathname.replace(/\/$/, "").split("/").slice(1);

  return (
    parts.length === segments.length &&
    segments.every((segment, index) =>
      segment.startsWith(dynamicPrefix) ? Boolean(parts[index]) : segment === parts[index],
    )
  );
}

function rewrittenUrl(url: URL, deployment: DevelopmentDeployment): URL {
  for (const rewrite of deployment.rewrites.filter((entry) => entry.source.startsWith("/api/"))) {
    const segments = rewrite.source.split("/").slice(1);
    if (!matches(segments, url.pathname, ":")) continue;
    const parts = url.pathname.replace(/\/$/, "").split("/").slice(1);
    const destination = rewrite.destination.replace(/:(\w+)/g, (_match, name: string) => {
      const index = segments.indexOf(`:${name}`);
      if (index < 0 || !parts[index]) throw new Error("Unsupported local API rewrite.");

      return encodeURIComponent(parts[index]);
    });
    const result = new URL(destination, url.origin);
    if (!result.pathname.startsWith("/api/")) throw new Error("Unsupported local API rewrite.");
    // Destination parameters win; callers cannot replace the path's Topic or generation marker.
    const destinationKeys = new Set(result.searchParams.keys());
    for (const [key, value] of url.searchParams) {
      if (!destinationKeys.has(key)) result.searchParams.append(key, value);
    }

    return result;
  }

  return url;
}

function safeFailure(): Response {
  return new Response("Local API request failed.", {
    status: 500,
    headers: { "Cache-Control": "no-store" },
  });
}

async function apiResponse(
  request: Request,
  server: ViteDevServer,
  routes: ApiRoute[],
  deployment: DevelopmentDeployment,
): Promise<Response> {
  const original = new URL(request.url);
  const target = rewrittenUrl(original, deployment);
  const route = routes.find((entry) => matches(entry.segments, target.pathname, "["));
  if (!route) return new Response("Not found", { status: 404 });

  // This path comes only from the startup inventory, never from a request's path or parameters.
  const loaded: unknown = await server.ssrLoadModule(route.file);
  const module = apiModuleSchema.parse(loaded);
  const allowed = methods.filter((method) => typeof module[method] === "function");
  if (allowed.includes("GET") && !allowed.includes("HEAD")) allowed.splice(1, 0, "HEAD");
  const method =
    request.method === "HEAD" && typeof module.HEAD !== "function" ? "GET" : request.method;
  const selected = methods.find((entry) => entry === method);
  const handler = selected ? module[selected] : undefined;
  if (!handler) {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: allowed.join(", ") },
    });
  }

  // Keep the original dynamic pathname: Cards, Collections and audio parse their IDs from it.
  original.search = target.search;
  const forwarded = new Request(original, request);
  const response: unknown = await handler(forwarded);
  if (!(response instanceof Response)) throw new Error("Invalid local API response.");
  if (request.method !== "HEAD") return response;
  await response.body?.cancel();

  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** Production headers remain untouched. Vite injects inline refresh code and CSS during development. */
export function developmentHeaders(deployment: DevelopmentDeployment): Record<string, string> {
  return Object.fromEntries(
    deployment.headers
      .filter((entry) => entry.source === "/(.*)")
      .flatMap((entry) =>
        entry.headers.map(({ key, value }) => [
          key,
          key.toLowerCase() === "content-security-policy"
            ? value
                .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
                .replace("style-src-elem 'self'", "style-src-elem 'self' 'unsafe-inline'")
                .replace(
                  "connect-src 'self'",
                  "connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
                )
            : value,
        ]),
      ),
  );
}

/** A browser boundary in both dev modes; API dispatch is explicitly opt-in, never used for builds. */
export function localDevelopmentPlugin(
  deployment: DevelopmentDeployment,
  fullstack: boolean,
): Plugin {
  let root = "";

  return {
    name: "local-development-boundary",
    apply: "serve",
    enforce: "pre",
    config() {
      return {
        server: {
          host: "127.0.0.1",
          strictPort: true,
          allowedHosts: ["localhost"],
          cors: false,
          headers: developmentHeaders(deployment),
        },
      };
    },
    configResolved(config) {
      if (config.server.host !== "127.0.0.1" || !config.server.strictPort) {
        throw new Error("Local development requires a strict loopback-only listener.");
      }
      root = realpathSync(config.root);
    },
    async resolveId(source, importer, options) {
      // Vitest's module-runner environments are server-side too, even without options.ssr.
      if (options.ssr || this.environment.name !== "client") return;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || !isAbsolute(resolved.id)) return;
      const file = resolved.id.split("?")[0]!;
      if (
        !browserFile(file, root) ||
        (existsSync(file) && !browserFile(realpathSync(file), root))
      ) {
        throw new Error("Server-only files cannot enter the browser module graph.");
      }
    },
    configureServer(server) {
      const routes = fullstack ? apiRoutes(root) : [];
      const publicPaths = new Set(
        globSync("**/*", { cwd: resolve(root, "public"), withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map(
            (entry) =>
              `/${normalizePath(relative(resolve(root, "public"), resolve(entry.parentPath, entry.name)))}`,
          ),
      );
      const listener = getRequestListener(
        (request) => apiResponse(request, server, routes, deployment).catch(safeFailure),
        { overrideGlobalObjects: false, errorHandler: safeFailure },
      );
      // Vite installs hostValidationMiddleware BEFORE configureServer hooks. Keep that protection,
      // and narrow its default (which also accepts arbitrary IP hosts) to this loopback server.
      server.middlewares.use((request, response, next) => {
        for (const [key, value] of Object.entries(developmentHeaders(deployment)))
          response.setHeader(key, value);
        const host = request.headers.host;
        const address = server.httpServer?.address();
        const port =
          address && typeof address !== "string" ? address.port : server.config.server.port;
        if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
          response.writeHead(403).end("Forbidden host");

          return;
        }
        let pathname: string;
        try {
          pathname = decodeURIComponent((request.url ?? "").split("?")[0]!);
        } catch {
          response.writeHead(400).end("Invalid path");

          return;
        }
        if (
          !pathname.startsWith("/") ||
          /[\\\0-\x20%#]/.test(pathname) ||
          pathname.includes("//") ||
          pathname.split("/").some((part) => part === "." || part === "..")
        ) {
          response.writeHead(404).end("Not found");

          return;
        }
        const segments = pathname.split("/");
        const api = segments[1] === "api";
        if (api && fullstack && !pathname.includes(".") && !pathname.includes("[")) {
          void listener(request, response);

          return;
        }
        const sourceFile = resolve(root, `.${pathname}`);
        const source =
          pathname.startsWith("/src/") &&
          browserFile(sourceFile, root) &&
          existsSync(sourceFile) &&
          isWithin(realpathSync(sourceFile), resolve(root, "src")) &&
          browserFile(realpathSync(sourceFile), root);
        const vite = [
          "/@vite/client",
          "/@vite/env",
          "/@react-refresh",
          "/node_modules/vite/dist/client/env.mjs",
        ].includes(pathname);
        const optimized = /^\/node_modules\/\.vite\/deps\/[\w@-]+\.js(?:\.map)?$/.test(pathname);
        const publicFile = resolve(root, "public", `.${pathname}`);
        const publicAsset =
          publicPaths.has(pathname) &&
          existsSync(publicFile) &&
          isWithin(realpathSync(publicFile), resolve(root, "public")) &&
          browserFile(realpathSync(publicFile), root);
        if (api || (!source && !vite && !optimized && !publicAsset && pathname !== "/index.html")) {
          // Only extensionless application URLs become SPA pages. Never let Vite's filesystem
          // middleware serve repository files (including extensionless Dockerfiles or secrets).
          if (
            !api &&
            !pathname.includes(".") &&
            !["src", "node_modules"].includes(segments[1] ?? "") &&
            !pathname.startsWith("/@") &&
            !pathname.startsWith("/__")
          ) {
            request.url = "/index.html";
          } else {
            response.writeHead(404).end("Not found");

            return;
          }
        }
        next();
      });
    },
    handleHotUpdate(context) {
      if (isServerFile(context.file, root)) {
        context.server.ws.send({ type: "full-reload" });

        return [];
      }
    },
  };
}
