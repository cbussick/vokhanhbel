import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { capture, run } from "./process.ts";

const directUrl = process.env.DATABASE_URL_UNPOOLED;
const expectedHost = process.env.PRODUCTION_DATABASE_HOST;
const recipient = process.env.AGE_RECIPIENT;
const backupDirectory = process.env.BACKUP_DIRECTORY;

if (!directUrl || !expectedHost || !recipient || !backupDirectory)
  throw new Error(
    "DATABASE_URL_UNPOOLED, PRODUCTION_DATABASE_HOST, AGE_RECIPIENT, and BACKUP_DIRECTORY are required",
  );

const databaseUrl = new URL(directUrl);

if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol))
  throw new Error("The migration target must be PostgreSQL");
if (databaseUrl.hostname !== expectedHost)
  throw new Error("The migration target does not match PRODUCTION_DATABASE_HOST");

const repository = resolve(import.meta.dirname, "..");
const backupRoot = resolve(backupDirectory);

if (backupRoot === repository || backupRoot.startsWith(`${repository}/`))
  throw new Error("BACKUP_DIRECTORY must be outside the repository");

await mkdir(backupRoot, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
const plainBackup = resolve(backupRoot, `vokhanhbel-${timestamp}.dump`);
const encryptedBackup = `${plainBackup}.age`;
const validationBackup = `${plainBackup}.validation`;
let encryptedBackupValidated = false;

for (const command of ["pg_dump", "pg_restore"]) {
  const version = await capture(command, ["--version"]);
  const majorVersion = /PostgreSQL\) (\d+)/u.exec(version)?.[1];

  if (majorVersion !== "17") throw new Error(`${command} major version 17 is required`);
}

try {
  await run("pg_dump", ["--format=custom", "--no-owner", "--file", plainBackup, directUrl]);
  await run("pg_restore", ["--list", plainBackup]);
  await run("age", ["--recipient", recipient, "--output", encryptedBackup, plainBackup]);
  const identityFile = process.env.AGE_IDENTITY_FILE;

  if (!identityFile)
    throw new Error("AGE_IDENTITY_FILE is required to validate the encrypted backup");
  await run("age", [
    "--decrypt",
    "--identity",
    identityFile,
    "--output",
    validationBackup,
    encryptedBackup,
  ]);
  await run("pg_restore", ["--list", validationBackup]);
  encryptedBackupValidated = true;
  await rm(validationBackup, { force: true });
  await rm(plainBackup, { force: true });
  await run("npm", ["run", "db:migrate"], { ...process.env, DATABASE_URL_UNPOOLED: directUrl });
  process.stdout.write(`Migration complete. Encrypted backup: ${encryptedBackup}\n`);
} catch (error) {
  await rm(plainBackup, { force: true });
  await rm(validationBackup, { force: true });
  if (!encryptedBackupValidated) await rm(encryptedBackup, { force: true });
  throw error;
}
