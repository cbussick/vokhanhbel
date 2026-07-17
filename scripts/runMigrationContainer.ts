import { access, chmod, mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { run } from "./process.ts";

const repository = resolve(import.meta.dirname, "..");
const dockerfile = resolve(repository, "Dockerfile.migration");
const identityDirectory = resolve(repository, ".secrets");
const identityFile = resolve(identityDirectory, "age-identity.txt");
const containerIdentityFile = "/run/secrets/age-identity.txt";
const image = "vokhanhbel-migration:local";
const action = process.argv[2];
const user = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;

function bindMount(source: string, target: string, readOnly = false) {
  return `type=bind,source=${source},target=${target}${readOnly ? ",readonly" : ""}`;
}

async function requireIdentity() {
  try {
    await access(identityFile);
  } catch {
    throw new Error("Missing .secrets/age-identity.txt; run npm run backup:identity:generate");
  }
}

async function buildImage() {
  await run("docker", ["build", "--file", dockerfile, "--tag", image, repository]);
}

function dockerRun(options: string[], command: string[] = []) {
  return run("docker", ["run", "--rm", "--user", user, ...options, image, ...command]);
}

switch (action) {
  case "keygen": {
    await mkdir(identityDirectory, { recursive: true, mode: 0o700 });
    try {
      await access(identityFile);
      throw new Error(".secrets/age-identity.txt already exists; refusing to overwrite it");
    } catch (error) {
      if (error instanceof Error && !error.message.includes("ENOENT")) throw error;
    }
    await buildImage();
    await dockerRun(
      ["--mount", bindMount(identityDirectory, "/identity")],
      ["age-keygen", "--output", "/identity/age-identity.txt"],
    );
    await chmod(identityFile, 0o600);
    process.stdout.write(
      "Identity created at .secrets/age-identity.txt. Back it up in your password manager.\n",
    );
    break;
  }
  case "recipient": {
    await requireIdentity();
    await buildImage();
    await dockerRun(
      ["--mount", bindMount(identityFile, containerIdentityFile, true)],
      ["age-keygen", "-y", containerIdentityFile],
    );
    break;
  }
  case "migrate": {
    const databaseUrl = process.env.DATABASE_URL_UNPOOLED;
    const configuredBackupDirectory = process.env.BACKUP_DIRECTORY;

    if (!databaseUrl || !configuredBackupDirectory)
      throw new Error("DATABASE_URL_UNPOOLED and BACKUP_DIRECTORY are required");
    if (!isAbsolute(configuredBackupDirectory))
      throw new Error("BACKUP_DIRECTORY must be an absolute path");

    const parsedDatabaseUrl = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol))
      throw new Error("The migration target must be PostgreSQL");

    const backupDirectory = resolve(configuredBackupDirectory);
    if (backupDirectory === repository || backupDirectory.startsWith(`${repository}/`))
      throw new Error("BACKUP_DIRECTORY must be outside the repository");

    await requireIdentity();
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await buildImage();
    await dockerRun([
      "--env",
      "DATABASE_URL_UNPOOLED",
      "--env",
      "BACKUP_DIRECTORY=/backups",
      "--env",
      `AGE_IDENTITY_FILE=${containerIdentityFile}`,
      "--mount",
      bindMount(backupDirectory, "/backups"),
      "--mount",
      bindMount(identityFile, containerIdentityFile, true),
    ]);
    break;
  }
  case "restore": {
    const encryptedBackup = process.argv[3];
    const restoreUrl = process.env.RESTORE_DATABASE_URL;

    if (!encryptedBackup || !restoreUrl)
      throw new Error(
        "Usage: RESTORE_DATABASE_URL=postgresql://... npm run db:restore:verify -- /absolute/backup.dump.age",
      );
    if (!isAbsolute(encryptedBackup)) throw new Error("The backup path must be absolute");

    await access(encryptedBackup);
    await requireIdentity();
    await buildImage();
    const environmentArguments = [
      "--env",
      "RESTORE_DATABASE_URL",
      "--env",
      `AGE_IDENTITY_FILE=${containerIdentityFile}`,
    ];
    if (process.env.DATABASE_URL_UNPOOLED)
      environmentArguments.push("--env", "DATABASE_URL_UNPOOLED");
    await dockerRun(
      [
        ...environmentArguments,
        "--mount",
        bindMount(identityFile, containerIdentityFile, true),
        "--mount",
        bindMount(resolve(encryptedBackup), "/input/backup.dump.age", true),
      ],
      ["npm", "run", "db:restore:verify:container", "--", "/input/backup.dump.age"],
    );
    break;
  }
  default:
    throw new Error("Expected one of: keygen, recipient, migrate, restore");
}
