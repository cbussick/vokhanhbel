import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, beforeEach } from "vitest";
import { getDatabase, getPool } from "../../src/server/database/client.js";
import { defaultCollectionId } from "../../src/server/database/schema.js";

beforeAll(async () => {
  await migrate(getDatabase(), { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  await getPool().query(
    "TRUNCATE ai_usage, audio_upload_attempts, login_attempts, sessions, reviews, cards, audio_cleanup_jobs, audio_assets RESTART IDENTITY CASCADE",
  );
  // The Collection the cards.collection_id default points at has to survive every reset.
  await getPool().query("DELETE FROM collections WHERE id <> $1", [defaultCollectionId]);
  await getPool().query(
    "UPDATE collections SET name=$2, normalized_name=$2, deleted_at=NULL WHERE id=$1",
    [defaultCollectionId, "Vietnamesisch"],
  );
});
