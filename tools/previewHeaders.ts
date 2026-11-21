import { readFileSync } from "node:fs";
import { z } from "zod";

const deploymentSchema = z.object({
  headers: z.array(
    z.object({
      source: z.string(),
      headers: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
  ),
});
const deployment = deploymentSchema.parse(
  JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")),
);

/**
 * The preview server backs the end-to-end suite, so it has to answer with the same headers
 * production sends. Reading them from vercel.json keeps one source of truth.
 */
export const previewHeaders = Object.fromEntries(
  deployment.headers
    .filter((entry) => entry.source === "/(.*)")
    .flatMap((entry) => entry.headers.map(({ key, value }) => [key, value])),
);
