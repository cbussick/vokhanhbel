import { describe, expect, it } from "vitest";
import {
  composeProjectName,
  databaseUrlFromPublishedPort,
  developmentEnvironment,
  localAudioDirectory,
  vercelDevelopmentEnvironment,
} from "./localDevelopment.js";

describe("local development identity", () => {
  it("is stable for the same checkout and isolated between worktrees", () => {
    const first = composeProjectName("/repo/.worktrees/VOK-44");

    expect(composeProjectName("/repo/.worktrees/VOK-44")).toBe(first);
    expect(composeProjectName("/repo/.worktrees/VOK-45")).not.toBe(first);
    expect(first).toMatch(/^vokhanhbel-dev-vok-44-[a-f0-9]{10}$/);
  });

  it("keeps long and unusual checkout names safe for Compose", () => {
    expect(composeProjectName("/repo/.worktrees/A Ticket With Spaces & Symbols")).toMatch(
      /^vokhanhbel-dev-a-ticket-with-spaces-sym-[a-f0-9]{10}$/,
    );
  });
});

describe("development command environments", () => {
  const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:49172/vokhanhbel";

  it("overrides copied database targets for migrations", () => {
    expect(
      developmentEnvironment(databaseUrl, {
        DATABASE_URL: "postgresql://production.example.com/app",
        DATABASE_URL_UNPOOLED: "postgresql://production.example.com/app",
      }),
    ).toMatchObject({
      DATABASE_URL: databaseUrl,
      DATABASE_URL_UNPOOLED: databaseUrl,
      AUDIO_OBJECT_DIRECTORY: localAudioDirectory(process.cwd()),
    });
  });

  it("does not pass the migration-only URL to Vercel Local", () => {
    const environment = vercelDevelopmentEnvironment(developmentEnvironment(databaseUrl, {}));

    expect(environment.DATABASE_URL).toBe(databaseUrl);
    expect(environment.DATABASE_URL_UNPOOLED).toBeUndefined();
  });
});

describe("discovered development connection", () => {
  it("builds the fixed local database URL from Docker's loopback port", () => {
    expect(databaseUrlFromPublishedPort("127.0.0.1:49172\n")).toBe(
      "postgresql://postgres:postgres@127.0.0.1:49172/vokhanhbel",
    );
  });

  it.each([
    "0.0.0.0:49172",
    "192.0.2.10:49172",
    "database.example.com:5432",
    "127.0.0.1:0",
    "postgresql://production.example.com/vokhanhbel",
  ])("refuses a non-local or invalid discovered target: %s", (target) => {
    expect(() => databaseUrlFromPublishedPort(target)).toThrow(/Refusing/);
  });
});
