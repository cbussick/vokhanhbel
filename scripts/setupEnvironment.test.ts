import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setupEnvironment } from "./setupEnvironment.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("environment setup", () => {
  it("copies the example once without overwriting an existing environment", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vokhanhbel-setup-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, ".env.example"), "APP_PASSWORD_HASH=\n");

    await expect(setupEnvironment(directory)).resolves.toBe("created");
    await expect(readFile(join(directory, ".env.local"), "utf8")).resolves.toBe(
      "APP_PASSWORD_HASH=\n",
    );

    await writeFile(join(directory, ".env.local"), "APP_PASSWORD_HASH=keep-me\n");
    await expect(setupEnvironment(directory)).resolves.toBe("exists");
    await expect(readFile(join(directory, ".env.local"), "utf8")).resolves.toBe(
      "APP_PASSWORD_HASH=keep-me\n",
    );
  });
});
