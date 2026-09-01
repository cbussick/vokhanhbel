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
 * maps onto a speech voice. A Collection face without a language here has none declared: null is
 * the only way to say that, and no sentinel locale stands in for it.
 */
export const collectionLanguages = ["vi-VN", "de-DE", "en-US"] as const;
export const collectionLanguageSchema = z.enum(collectionLanguages);
export type CollectionLanguage = z.infer<typeof collectionLanguageSchema>;

// A language a newer deploy declared but this one does not support reads as none declared.
const declaredLanguageSchema = collectionLanguageSchema.nullable().catch(null);

export const collectionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(60),
  // An older client must render a Collection a newer one wrote, so an unknown icon degrades.
  icon: collectionIconSchema.catch(defaultCollectionIcon),
  frontLanguage: declaredLanguageSchema,
  backLanguage: declaredLanguageSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export type Collection = z.infer<typeof collectionSchema>;

export const collectionInputSchema = z.object({
  name: collectionNameSchema,
  icon: collectionIconSchema,
  frontLanguage: collectionLanguageSchema.nullable().default(null),
  backLanguage: collectionLanguageSchema.nullable().default(null),
});
export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const collectionListSchema = z.array(collectionSchema);
