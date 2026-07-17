import { readFile } from "node:fs/promises";

interface PackageEntry {
  license?: string;
  licenses?: { type?: string }[];
}

interface PackageLock {
  packages: Record<string, PackageEntry>;
}

interface LicensePolicy {
  approved: string[];
  overrides?: Record<string, string>;
}

const lock = JSON.parse(await readFile("package-lock.json", "utf8")) as PackageLock;
const policy = JSON.parse(await readFile("license-policy.json", "utf8")) as LicensePolicy;
const approved = new Set(policy.approved);
const failures: string[] = [];

for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith("node_modules/")) continue;
  const name = path.slice("node_modules/".length);
  let license = policy.overrides?.[name] ?? entry.license;

  if (!license) {
    const manifest = JSON.parse(await readFile(`${path}/package.json`, "utf8")) as PackageEntry;
    license = manifest.license ?? manifest.licenses?.map((item) => item.type).join(" OR ");
  }
  if (!license || !approved.has(license)) failures.push(`${name}: ${license ?? "missing"}`);
}

if (failures.length > 0) {
  throw new Error(`Unapproved or unclear dependency licenses:\n${failures.join("\n")}`);
}

process.stdout.write(
  `All dependency licenses match the reviewed policy (${approved.size} forms).\n`,
);
