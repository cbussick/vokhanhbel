import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, beforeEach } from "vitest";
import { getDatabase, getPool } from "../../src/server/database/client.js";

beforeAll(async () => {
  await migrate(getDatabase(), { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  await getPool().query(
    "TRUNCATE ai_usage, login_attempts, sessions, reviews, cards RESTART IDENTITY CASCADE",
  );
});
