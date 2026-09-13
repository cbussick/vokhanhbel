import { execFile } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const runCommand = promisify(execFile);
const repositoryRoot = process.cwd();
const launcher = resolve(repositoryRoot, "scripts/localDevelopment.ts");
const composeFile = resolve(repositoryRoot, "docker-compose.development.yml");
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "vokhanhbel-local-development-"));
const checkouts = [
  resolve(temporaryRoot, "first-worktree"),
  resolve(temporaryRoot, "second-worktree"),
];

async function runLauncher(checkout: string, command: "up" | "clean"): Promise<string> {
  const { stdout } = await runCommand(
    process.execPath,
    ["--experimental-strip-types", launcher, command],
    { cwd: checkout, encoding: "utf8" },
  );

  return stdout;
}

function connectionFromOutput(output: string): { project: string; url: string } {
  const match = /Database: project=([^,]+), host=127\.0\.0\.1, port=(\d+)/.exec(output);
  if (!match) throw new Error(`Launcher did not print the expected database identity:\n${output}`);

  return {
    project: match[1]!,
    url: `postgresql://postgres:postgres@127.0.0.1:${match[2]!}/vokhanhbel`,
  };
}

async function writeAndReadMarker(url: string, marker: string): Promise<string[]> {
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("CREATE TABLE smoke_test_markers (value text NOT NULL)");
    await client.query("INSERT INTO smoke_test_markers (value) VALUES ($1)", [marker]);
    const result = await client.query<{ value: string }>("SELECT value FROM smoke_test_markers");

    return result.rows.map(({ value }) => value);
  } finally {
    await client.end();
  }
}

afterAll(async () => {
  await Promise.allSettled(checkouts.map((checkout) => runLauncher(checkout, "clean")));
  rmSync(temporaryRoot, { recursive: true, force: true });
});

describe("isolated local development databases", () => {
  it("gives concurrent worktrees distinct ports, projects, volumes, and data", async () => {
    for (const checkout of checkouts) {
      mkdirSync(checkout);
      copyFileSync(composeFile, resolve(checkout, "docker-compose.development.yml"));
    }

    const connections = await Promise.all(
      checkouts.map(async (checkout) => connectionFromOutput(await runLauncher(checkout, "up"))),
    );
    const first = connections[0]!;
    const second = connections[1]!;

    expect(first.project).not.toBe(second.project);
    expect(new URL(first.url).port).not.toBe(new URL(second.url).port);
    expect(await writeAndReadMarker(first.url, "first-worktree")).toEqual(["first-worktree"]);
    expect(await writeAndReadMarker(second.url, "second-worktree")).toEqual(["second-worktree"]);
  });
});
