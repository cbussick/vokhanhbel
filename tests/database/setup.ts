import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, beforeEach } from "vitest";
import { getDatabase, getPool } from "../../src/server/database/client.js";
import { defaultCollectionId } from "../../src/server/database/schema.js";

beforeAll(async () => {
  await migrate(getDatabase(), { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  await getPool().query(
    "TRUNCATE ai_usage, audio_playback_attempts, audio_upload_attempts, login_attempts, sessions, reviews, card_topics, cards, topics, audio_cleanup_jobs, audio_assets RESTART IDENTITY CASCADE",
  );
  await getPool().query("DELETE FROM collections WHERE id <> $1", [defaultCollectionId]);
  await getPool().query(
    `INSERT INTO collections (id, name, normalized_name)
     VALUES ($1, $2, $2)
     ON CONFLICT (id) DO UPDATE
     SET name=$2, normalized_name=$2, deleted_at=NULL`,
    [defaultCollectionId, "Vietnamesisch"],
  );
});
