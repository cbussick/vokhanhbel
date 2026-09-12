import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { basename, resolve } from "node:path";

const repositoryRoot = process.cwd();
const composeFile = "docker-compose.development.yml";
const databaseName = "vokhanhbel";

export function composeProjectName(checkoutPath: string): string {
  const canonicalPath = resolve(checkoutPath);
  const readableName = basename(canonicalPath)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const pathHash = createHash("sha256").update(canonicalPath).digest("hex").slice(0, 10);

  return `vokhanhbel-dev-${readableName || "checkout"}-${pathHash}`;
}

export function databaseUrlFromPublishedPort(output: string): string {
  const address = output.trim();
  const match = /^(?:127\.0\.0\.1|\[::1\]):(\d+)$/.exec(address);
  if (!match) {
    throw new Error(
      `Refusing PostgreSQL binding ${JSON.stringify(address)}: expected a loopback-only published port.`,
    );
  }

  const port = Number(match[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Refusing invalid PostgreSQL port ${JSON.stringify(match[1])}.`);
  }

  return `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}`;
}

function dockerArguments(project: string, ...args: string[]): string[] {
  return ["compose", "--project-name", project, "--file", composeFile, ...args];
}

function runDocker(project: string, ...args: string[]): string {
  return execFileSync("docker", dockerArguments(project, ...args), {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
}

function startDatabase(project: string): string {
  runDocker(project, "up", "--detach", "--wait", "postgres");
  const publishedPort = runDocker(project, "port", "postgres", "5432");

  return databaseUrlFromPublishedPort(publishedPort);
}

function developmentEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  // Override both names because drizzle.config.ts intentionally prefers the unpooled URL.
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: databaseUrl,
  };
}

function runNode(script: string, args: string[], environment: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);

        return;
      }
      resolveExit(code ?? 1);
    });
  });
}

async function availableApplicationPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local application port."));

        return;
      }

      server.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
}

async function runApplication(project: string, databaseUrl: string): Promise<number> {
  const environment = developmentEnvironment(databaseUrl);
  const drizzle = resolve(repositoryRoot, "node_modules/drizzle-kit/bin.cjs");
  const migrationExit = await runNode(drizzle, ["migrate"], environment);
  if (migrationExit !== 0) return migrationExit;

  const port = await availableApplicationPort();
  const applicationUrl = `http://127.0.0.1:${port}`;
  console.log(`\nApplication: ${applicationUrl}`);
  console.log(`Database: project=${project}, host=127.0.0.1, port=${new URL(databaseUrl).port}`);
  console.log(`Data volume: ${project}_vokhanhbel-postgres-data-v1\n`);

  const vercel = resolve(repositoryRoot, "node_modules/vercel/dist/index.js");

  return runNode(vercel, ["dev", "--local", "--listen", `127.0.0.1:${port}`], environment);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "app";
  const project = composeProjectName(repositoryRoot);

  if (command === "stop") {
    runDocker(project, "down");

    return;
  }
  if (command === "clean") {
    runDocker(project, "down", "--volumes");

    return;
  }
  if (command === "inspect") {
    console.log(`Compose project: ${project}`);
    process.stdout.write(runDocker(project, "ps"));

    return;
  }

  const databaseUrl = startDatabase(project);
  console.log(`Database: project=${project}, host=127.0.0.1, port=${new URL(databaseUrl).port}`);

  if (command === "up") return;
  if (command === "studio") {
    const drizzle = resolve(repositoryRoot, "node_modules/drizzle-kit/bin.cjs");
    process.exitCode = await runNode(drizzle, ["studio"], developmentEnvironment(databaseUrl));

    return;
  }
  if (command !== "app") throw new Error(`Unknown local development command: ${command}`);

  process.exitCode = await runApplication(project, databaseUrl);
}

if (basename(process.argv[1] ?? "") === "localDevelopment.ts") {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
