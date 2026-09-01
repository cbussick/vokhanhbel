import { z } from "zod";
import { maximumCardTextLength } from "./card.js";
import { collectionLanguageSchema } from "./collection.js";
import { createNormalizedTextSchema } from "./common.js";

/**
 * The text is normalized exactly the way Card text is, so the text stored on a generated clip and
 * the text on the Card face it was generated for stay comparable. The language is narrowed to a
 * locale this build can speak: an absent or unsupported one is rejected here rather than reaching
 * the voice map.
 */
export const pronunciationInputSchema = z.object({
  text: createNormalizedTextSchema(maximumCardTextLength),
  language: collectionLanguageSchema,
});
export type PronunciationInput = z.infer<typeof pronunciationInputSchema>;
