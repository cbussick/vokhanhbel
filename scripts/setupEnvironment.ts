import { constants, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function setupEnvironment(directory = process.cwd()): Promise<"created" | "exists"> {
  try {
    await copyFile(
      join(directory, ".env.example"),
      join(directory, ".env.local"),
      constants.COPYFILE_EXCL,
    );

    return "created";
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return "exists";
    throw error;
  }
}

export async function main(): Promise<void> {
  const result = await setupEnvironment();
  const message =
    result === "created"
      ? "Created .env.local from .env.example."
      : ".env.local already exists; left unchanged.";
  process.stdout.write(
    `${message}\nNext: run npm run password:hash and paste its output into .env.local.\n`,
  );
}

const scriptPath = process.argv[1];

if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Environment setup failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
