import { describe, expect, it } from "vitest";
import { audioMetadataSchema, cardListSchema } from "../contracts/card";
import { collectionListSchema } from "../contracts/collection";
import { statsSchema } from "../contracts/stats";
import { topicListSchema } from "../contracts/topic";
import { audio, cards, collections, generatedAudio, stats, topics } from "./fixtures";

describe("Storybook's fixture and foundation contracts", () => {
  it("uses data accepted by the actual application contracts", () => {
    expect(cardListSchema.parse(cards)).toEqual(cards);
    expect(collectionListSchema.parse(collections)).toEqual(collections);
    expect(topicListSchema.parse(topics)).toEqual(topics);
    expect(audioMetadataSchema.parse(audio)).toEqual(audio);
    expect(audioMetadataSchema.parse(generatedAudio)).toEqual(generatedAudio);
    expect(statsSchema.parse(stats)).toEqual(stats);
  });
});
