import { pathToFileURL } from "node:url";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { encodePassword } from "../src/server/auth/password.ts";

class HiddenInputOutput extends Writable {
  muted = false;

  override _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) process.stdout.write(chunk, encoding);
    callback();
  }
}

export async function main(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }

  const output = new HiddenInputOutput();
  const prompts = createInterface({ input: process.stdin, output, terminal: true });

  try {
    process.stdout.write("Password: ");
    output.muted = true;
    const password = await prompts.question("");
    output.muted = false;
    process.stdout.write("\nConfirm password: ");
    output.muted = true;
    const confirmation = await prompts.question("");
    output.muted = false;
    process.stdout.write("\n");

    if (password !== confirmation) throw new Error("Passwords do not match.");

    const encoded = await encodePassword(password);
    process.stdout.write(`APP_PASSWORD_HASH=${encoded}\n`);
  } finally {
    output.muted = false;
    prompts.close();
  }
}

const scriptPath = process.argv[1];

if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Password hashing failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
