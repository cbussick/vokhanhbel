import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";
import { maintenanceDatabaseUrl, testDatabaseName } from "./testDatabase.js";

const runCommand = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

if (!testDatabaseName.endsWith("_test")) {
  throw new Error(`Refusing to manage ${testDatabaseName}: a test database must end in "_test".`);
}

async function isPostgresReachable(): Promise<boolean> {
  const client = new Client({
    connectionString: maintenanceDatabaseUrl,
    connectionTimeoutMillis: 2_000,
  });

  try {
    await client.connect();
    await client.end();

    return true;
  } catch {
    return false;
  }
}

/**
 * Reachability decides whether to start Compose, rather than an environment flag: a server that
 * already answers is left alone, so this is a no-op against the CI service container and against a
 * container the developer started, and only starts one when nothing is listening.
 */
async function ensurePostgresRunning(): Promise<void> {
  if (await isPostgresReachable()) return;

  try {
    await runCommand("docker", ["compose", "up", "--detach", "--wait", "postgres"], {
      cwd: repositoryRoot,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";

    throw new Error(
      `No PostgreSQL server answered at ${maintenanceDatabaseUrl} and starting the Compose ` +
        `service failed. Start Docker, or bring the database up manually with ` +
        `"docker compose up -d postgres".\n${reason}`,
      { cause: error },
    );
  }
}

async function runMaintenanceStatement(statement: string): Promise<void> {
  const client = new Client({ connectionString: maintenanceDatabaseUrl });

  await client.connect();

  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

/**
 * The suite owns its database instead of expecting one to be there. Every run starts from an
 * empty database, so a schema left behind by another branch or a crashed run cannot leak in.
 * FORCE closes connections a previous run may have left open.
 */
export async function setup(): Promise<void> {
  await ensurePostgresRunning();
  await runMaintenanceStatement(`DROP DATABASE IF EXISTS ${testDatabaseName} WITH (FORCE)`);
  await runMaintenanceStatement(`CREATE DATABASE ${testDatabaseName}`);
}

export async function teardown(): Promise<void> {
  await runMaintenanceStatement(`DROP DATABASE IF EXISTS ${testDatabaseName} WITH (FORCE)`);
}
