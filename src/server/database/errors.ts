const uniqueViolationCode = "23505";
const foreignKeyViolationCode = "23503";

function hasDatabaseErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === code) return true;

  return "cause" in error && hasDatabaseErrorCode(error.cause, code);
}

export function isUniqueViolation(error: unknown): boolean {
  return hasDatabaseErrorCode(error, uniqueViolationCode);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasDatabaseErrorCode(error, foreignKeyViolationCode);
}
