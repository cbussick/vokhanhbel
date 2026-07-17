import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const scryptCost = 2 ** 17;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const scryptKeyLength = 32;
const scryptMaximumMemory = 256 * 1024 * 1024;

function assertPasswordLength(password: string): void {
  const length = Array.from(password).length;

  if (length < 6 || length > 128) throw new Error("password-length");
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      scryptKeyLength,
      { N: scryptCost, r: scryptBlockSize, p: scryptParallelization, maxmem: scryptMaximumMemory },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function encodePassword(password: string): Promise<string> {
  assertPasswordLength(password);
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);

  return [
    "scrypt",
    "v1",
    scryptCost,
    scryptBlockSize,
    scryptParallelization,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    assertPasswordLength(password);
    const [algorithm, version, cost, blockSize, parallelization, saltValue, keyValue] =
      encoded.split("$");

    if (
      algorithm !== "scrypt" ||
      version !== "v1" ||
      Number(cost) !== scryptCost ||
      Number(blockSize) !== scryptBlockSize ||
      Number(parallelization) !== scryptParallelization ||
      !saltValue ||
      !keyValue
    ) {
      return false;
    }

    const expectedKey = Buffer.from(keyValue, "base64url");

    if (expectedKey.length !== scryptKeyLength) return false;
    const actualKey = await deriveKey(password, Buffer.from(saltValue, "base64url"));

    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}
