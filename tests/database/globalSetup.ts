import { Client } from "pg";
import { maintenanceDatabaseUrl, testDatabaseName } from "./testDatabase.js";

if (!testDatabaseName.endsWith("_test")) {
  throw new Error(`Refusing to manage ${testDatabaseName}: a test database must end in "_test".`);
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
  await runMaintenanceStatement(`DROP DATABASE IF EXISTS ${testDatabaseName} WITH (FORCE)`);
  await runMaintenanceStatement(`CREATE DATABASE ${testDatabaseName}`);
}

export async function teardown(): Promise<void> {
  await runMaintenanceStatement(`DROP DATABASE IF EXISTS ${testDatabaseName} WITH (FORCE)`);
}
