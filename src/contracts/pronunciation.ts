import { z } from "zod";
import { maximumAudioDurationMs } from "./card.js";
import { collectionLanguageSchema } from "./collection.js";
import { createNormalizedTextSchema } from "./common.js";

/**
 * An upper bound on how fast a pinned voice speaks at the default rate. Ordinary speech runs at
 * roughly 15 characters per second and hurried speech at roughly 20, so this keeps headroom: the
 * length derived from it must never refuse text that could still have fitted.
 */
const speechCharactersPerSecond = 25;

/**
 * A generated clip has to fit the same duration cap a recording does. Text longer than the fastest
 * voice could speak inside that cap is refused before the provider is called, so the Learner does
 * not wait for, and the household does not pay for, a clip the audio inspector would reject on
 * arrival. Text within the bound may still come back too long; the inspector stays the judge of
 * the clip itself. Card text is bounded far higher, so a Card face can hold more text than can be
 * spoken onto it.
 */
export const maximumPronunciationTextLength = Math.floor(
  (maximumAudioDurationMs / 1_000) * speechCharactersPerSecond,
);

/**
 * The text is normalized exactly the way Card text is, so what a clip is spoken from — and later
 * shown to have been spoken from — is stored in one settled form. The language is narrowed to a
 * locale this build can speak: an absent or unsupported one is rejected here rather than reaching
 * the voice map.
 */
export const pronunciationInputSchema = z.object({
  text: createNormalizedTextSchema(maximumPronunciationTextLength),
  language: collectionLanguageSchema,
});
export type PronunciationInput = z.infer<typeof pronunciationInputSchema>;
