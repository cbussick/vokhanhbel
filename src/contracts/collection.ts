import { z } from "zod";
import { createNormalizedTextSchema, utcTimestampSchema, uuidSchema } from "./common.js";

const collectionNameSchema = createNormalizedTextSchema(60);

export const defaultCollectionIcon = "book";
/**
 * Append-only: a shipped key must keep working, because a migration reaches production before the
 * deploy that knows the key. Adding one is a code change; the column itself stays unconstrained.
 */
export const collectionIconKeys = [defaultCollectionIcon, "flag-vn", "flag-gb"] as const;
export const collectionIconSchema = z.enum(collectionIconKeys);
export type CollectionIconKey = z.infer<typeof collectionIconSchema>;

/**
 * Full locales rather than bare language codes, so a regional variant stays distinguishable and
 * maps onto a speech voice. This is the set this build can offer, not the set that may be stored:
 * a Collection may carry a locale a newer build declared.
 */
export const collectionLanguages = ["vi-VN", "de-DE", "en-US"] as const;
export const collectionLanguageSchema = z.enum(collectionLanguages);
export type CollectionLanguage = z.infer<typeof collectionLanguageSchema>;

/**
 * The stored locale, if this build offers it. A locale a newer build declared, or none at all,
 * yields undefined — which is how a caller decides whether a face can be spoken, without the
 * stored declaration ever being rewritten.
 */
export function offeredCollectionLanguage(language: string | null): CollectionLanguage | undefined {
  const result = collectionLanguageSchema.safeParse(language);

  return result.success ? result.data : undefined;
}

export const collectionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(60),
  // An older client must render a Collection a newer one wrote, so an unknown icon degrades.
  icon: collectionIconSchema.catch(defaultCollectionIcon),
  /**
   * Kept verbatim rather than degraded the way the icon is. A locale this build cannot offer is
   * still the Learner's declaration, and null already means "none declared" — folding one into the
   * other here would destroy it on the next save. Whether a locale can be spoken is decided where
   * it is used, not on the way in. An absent field is a response that predates the columns.
   */
  frontLanguage: z.string().nullable().default(null),
  backLanguage: z.string().nullable().default(null),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export type Collection = z.infer<typeof collectionSchema>;

export const collectionInputSchema = z.object({
  name: collectionNameSchema,
  icon: collectionIconSchema,
  /**
   * Optional the way a Card update's fields are: an absent language leaves the stored one alone,
   * an explicit null clears it. That keeps a client on an older build, which sends neither field,
   * from wiping a declaration it never knew about. Only a locale this build offers may be
   * declared, so an unsupported one survives by being left out rather than sent back.
   */
  frontLanguage: collectionLanguageSchema.nullable().optional(),
  backLanguage: collectionLanguageSchema.nullable().optional(),
});
export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const collectionListSchema = z.array(collectionSchema);
