import { defineConfig } from "drizzle-kit";

const migrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required for migrations");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/database/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
});
