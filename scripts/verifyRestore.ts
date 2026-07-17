import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { run } from "./process.ts";

const [encryptedBackup] = process.argv.slice(2);
const identity = process.env.AGE_IDENTITY_FILE;
const restoreUrl = process.env.RESTORE_DATABASE_URL;
const productionUrl = process.env.DATABASE_URL_UNPOOLED;

if (!encryptedBackup || !identity || !restoreUrl)
  throw new Error(
    "Usage: npm run db:restore:verify -- backup.dump.age (with AGE_IDENTITY_FILE and RESTORE_DATABASE_URL)",
  );
if (productionUrl && restoreUrl === productionUrl)
  throw new Error("RESTORE_DATABASE_URL must not be the production database");

const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "vokhanhbel-restore-"));
const plainBackup = resolve(temporaryDirectory, "backup.dump");

try {
  await run("age", ["--decrypt", "--identity", identity, "--output", plainBackup, encryptedBackup]);
  await run("pg_restore", ["--list", plainBackup]);
  await run("pg_restore", [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--exit-on-error",
    "--dbname",
    restoreUrl,
    plainBackup,
  ]);
  process.stdout.write("Restore verification completed successfully.\n");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
