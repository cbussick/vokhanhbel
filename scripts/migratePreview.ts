import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { run } from "./process.ts";

const repository = resolve(import.meta.dirname, "..");
const productionEnvironmentFile = resolve(repository, ".env.production-migration.local");
const drizzleKit = resolve(repository, "node_modules/drizzle-kit/bin.cjs");

interface DatabaseTarget {
  database: string;
  hostname: string;
  port: string;
  username: string;
}

export function parsePreviewTarget(value: string): URL {
  const target = new URL(value);

  if (!["postgres:", "postgresql:"].includes(target.protocol)) {
    throw new Error("The preview migration target must be PostgreSQL.");
  }
  if (!target.hostname || target.pathname === "/") {
    throw new Error("The preview connection string must include a host and database.");
  }
  if (target.hostname.includes("-pooler.")) {
    throw new Error("Use the direct Neon connection string, not the pooled connection string.");
  }

  return target;
}

function databaseIdentity(target: URL): string {
  const port = target.port || "5432";
  const database = decodeURIComponent(target.pathname);

  return `${target.hostname.toLowerCase()}:${port}${database}`;
}

export function assertDistinctFromProduction(preview: URL, productionValue?: string): void {
  if (!productionValue) return;

  const production = new URL(productionValue);

  if (databaseIdentity(preview) === databaseIdentity(production)) {
    throw new Error(
      "The preview target matches .env.production-migration.local; refusing to migrate.",
    );
  }
}

export function describeTarget(target: URL): DatabaseTarget {
  return {
    hostname: target.hostname,
    port: target.port || "default",
    database: decodeURIComponent(target.pathname.slice(1)),
    username: decodeURIComponent(target.username),
  };
}

async function readProductionDatabaseUrl(): Promise<string | undefined> {
  try {
    const contents = await readFile(productionEnvironmentFile, "utf8");

    return parseEnv(contents).DATABASE_URL_UNPOOLED;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function main(): Promise<void> {
  const previewValue = process.env.PREVIEW_DATABASE_URL_UNPOOLED;

  if (!previewValue) {
    throw new Error("PREVIEW_DATABASE_URL_UNPOOLED is required in .env.preview-migration.local.");
  }

  const preview = parsePreviewTarget(previewValue);
  assertDistinctFromProduction(preview, await readProductionDatabaseUrl());
  const target = describeTarget(preview);
  process.stdout.write(
    `Preview migration target:\n  Host: ${target.hostname}\n  Port: ${target.port}\n  Database: ${target.database}\n  User: ${target.username}\n`,
  );
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL_UNPOOLED: previewValue,
  };
  delete environment.PREVIEW_DATABASE_URL_UNPOOLED;
  await run(process.execPath, [drizzleKit, "migrate"], environment);
  process.stdout.write("Preview migration complete.\n");
}

const scriptPath = process.argv[1];

if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Preview migration failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
