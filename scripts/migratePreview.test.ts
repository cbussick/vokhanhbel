import { describe, expect, it } from "vitest";
import {
  assertDistinctFromProduction,
  describeTarget,
  parsePreviewTarget,
} from "./migratePreview.js";

describe("preview migration guard", () => {
  it("describes a direct PostgreSQL target without exposing its password or options", () => {
    const target = parsePreviewTarget(
      "postgresql://preview-user:do-not-print@ep-preview.eu-central-1.aws.neon.tech/preview-db?sslmode=require",
    );

    expect(describeTarget(target)).toEqual({
      hostname: "ep-preview.eu-central-1.aws.neon.tech",
      port: "default",
      database: "preview-db",
      username: "preview-user",
    });
    expect(JSON.stringify(describeTarget(target))).not.toContain("do-not-print");
    expect(JSON.stringify(describeTarget(target))).not.toContain("sslmode");
  });

  it("rejects a pooled Neon connection", () => {
    expect(() =>
      parsePreviewTarget(
        "postgresql://preview-user:secret@ep-preview-pooler.eu-central-1.aws.neon.tech/preview-db",
      ),
    ).toThrow("direct Neon connection string");
  });

  it("rejects the production database even when credentials and options differ", () => {
    const preview = parsePreviewTarget(
      "postgresql://preview-user:preview-secret@ep-production.eu-central-1.aws.neon.tech/app?sslmode=require",
    );

    expect(() =>
      assertDistinctFromProduction(
        preview,
        "postgresql://production-user:production-secret@ep-production.eu-central-1.aws.neon.tech:5432/app?sslmode=verify-full",
      ),
    ).toThrow("matches .env.production-migration.local");
  });
});
