import { expect, it } from "vitest";
import { cardInputWireSchema, collectionInputWireSchema } from "./wireSchemas";

it("keeps intercepted Card evidence without normalization, defaults or unknown-key stripping", () => {
  const sent = {
    collectionId: "collection",
    unexpected: "must remain visible",
    front: { text: "  not normalized  ", audioId: null, unexpectedFace: true },
    back: { text: "answer", audioId: null },
  };
  const parsed = cardInputWireSchema.parse(sent);
  expect(parsed).toEqual(sent);
  expect(parsed).not.toHaveProperty("topicIds");
  expect(() => cardInputWireSchema.parse({ ...sent, front: { audioId: null } })).toThrow("Invalid input");
});

it("keeps omitted Collection language declarations omitted", () => {
  const sent = { name: "  raw name  ", icon: "book", unexpected: "must remain visible" };
  const parsed = collectionInputWireSchema.parse(sent);
  expect(parsed).toEqual(sent);
  expect(parsed).not.toHaveProperty("frontLanguage");
  expect(parsed).not.toHaveProperty("backLanguage");
});
