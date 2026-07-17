import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { capture, run } from "./process.ts";

const directUrl = process.env.DATABASE_URL_UNPOOLED;
const backupDirectory = process.env.BACKUP_DIRECTORY;
const identityFile = process.env.AGE_IDENTITY_FILE;

if (!directUrl || !backupDirectory || !identityFile)
  throw new Error("DATABASE_URL_UNPOOLED, BACKUP_DIRECTORY, and AGE_IDENTITY_FILE are required");

const databaseUrl = new URL(directUrl);

if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol))
  throw new Error("The migration target must be PostgreSQL");

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

const ageVersion = await capture("age", ["--version"]);

if (!ageVersion.includes("1.3.1")) throw new Error("age version 1.3.1 is required");

const recipient = (await capture("age-keygen", ["-y", identityFile])).trim();

if (!recipient.startsWith("age1")) throw new Error("Could not derive the age recipient");

try {
  await run("pg_dump", [
    "--format=custom",
    "--no-acl",
    "--no-owner",
    "--file",
    plainBackup,
    directUrl,
  ]);
  await run("pg_restore", ["--list", plainBackup]);
  await run("age", ["--recipient", recipient, "--output", encryptedBackup, plainBackup]);
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
