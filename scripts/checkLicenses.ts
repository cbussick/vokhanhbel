import { readFile } from "node:fs/promises";

import { z } from "zod";

const packageEntrySchema = z.object({
  license: z.string().optional(),
  licenses: z.array(z.object({ type: z.string().optional() })).optional(),
});
const packageLockSchema = z.object({ packages: z.record(z.string(), packageEntrySchema) });
const licensePolicySchema = z.object({ approved: z.array(z.string()), overrides: z.record(z.string(), z.string()).optional() });

const lock = packageLockSchema.parse(JSON.parse(await readFile("package-lock.json", "utf8")));
const policy = licensePolicySchema.parse(JSON.parse(await readFile("license-policy.json", "utf8")));
const approved = new Set(policy.approved);
const failures: Array<string> = [];

for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith("node_modules/")) {continue;}
  const name = path.slice("node_modules/".length);
  let license = policy.overrides?.[name] ?? entry.license;

  if (!license) {
    const manifest = packageEntrySchema.parse(JSON.parse(await readFile(`${path}/package.json`, "utf8")));
    license = manifest.license ?? manifest.licenses?.map((item) => item.type).join(" OR ");
  }
  if (!license || !approved.has(license)) {failures.push(`${name}: ${license ?? "missing"}`);}
}

if (failures.length > 0) {
  throw new Error(`Unapproved or unclear dependency licenses:\n${failures.join("\n")}`);
}

process.stdout.write(
  `All dependency licenses match the reviewed policy (${approved.size} forms).\n`,
);
