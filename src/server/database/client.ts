import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnvironment } from "../config/environment.js";
import * as schema from "./schema.js";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

export function getPool(): Pool {
  pool ??= new Pool({
    connectionString: getServerEnvironment().DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  return pool;
}

export function getDatabase(): NodePgDatabase<typeof schema> {
  database ??= drizzle(getPool(), { schema });

  return database;
}
