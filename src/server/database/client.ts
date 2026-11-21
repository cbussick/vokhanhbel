import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnvironment } from "../config/environment.js";
import {
  aiUsage,
  audioAssets,
  audioCleanupJobs,
  audioPlaybackAttempts,
  audioUploadAttempts,
  cards,
  cardTopics,
  collections,
  defaultCollectionId,
  loginAttempts,
  reviews,
  sessions,
  topics,
} from "./schema.js";

const schema = {
  aiUsage,
  audioAssets,
  audioCleanupJobs,
  audioPlaybackAttempts,
  audioUploadAttempts,
  cards,
  cardTopics,
  collections,
  defaultCollectionId,
  loginAttempts,
  reviews,
  sessions,
  topics,
};

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
