import { z } from "zod";
import { containsRejectedControlCharacter, normalizeCardText } from "../domain/cardText.js";

export function createNormalizedTextSchema(maximumLength: number) {
  return z
    .string()
    .superRefine((value, context) => {
      if (containsRejectedControlCharacter(value)) {
        context.addIssue({ code: "custom", message: "control-character" });
      }
    })
    .transform(normalizeCardText)
    .pipe(z.string().min(1).max(maximumLength));
}

export const uuidSchema = z.uuid();
export const utcTimestampSchema = z.iso.datetime({ offset: false });
export const berlinDateSchema = z.iso.date();
