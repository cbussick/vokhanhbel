// eslint-disable-next-line no-control-regex -- these are the exact disallowed C0/C1 controls
const rejectedControlCharacterPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const horizontalWhitespacePattern = /[^\S\r\n]+/gu;

export function containsRejectedControlCharacter(value: string): boolean {
  return rejectedControlCharacterPattern.test(value);
}

export function normalizeCardText(value: string): string {
  if (containsRejectedControlCharacter(value)) {
    throw new Error("control-character");
  }

  return value
    .normalize("NFC")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.replace(horizontalWhitespacePattern, " ").trim())
    .join("\n")
    .trim();
}
