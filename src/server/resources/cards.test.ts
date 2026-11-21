import { beforeEach, expect, it, vi } from "vitest";
import { createCardWriter } from "./cards.js";
import type { getCard } from "./cards.js";

const query = vi.fn<
  (
    sql: string,
    values?: Array<unknown>,
  ) => Promise<{
    rows: Array<never>;
    command: string;
    rowCount: number;
    oid: number;
    fields: Array<never>;
  }>
>();
const client = { query, release: vi.fn<() => void>() };
const read = vi.fn<typeof getCard>();
const createCard = createCardWriter({ connect: async () => client, read });
const events: Array<string> = [];

beforeEach(() => {
  vi.resetAllMocks();
  events.length = 0;
  query.mockResolvedValue({ rows: [], command: "", rowCount: 0, oid: 0, fields: [] });
  client.release.mockImplementation(() => {
    events.push("release");
  });
});

it("releases the committed transaction before starting the separate Card read", async () => {
  const readFailure = new Error("read unavailable");
  read.mockImplementation(async () => {
    events.push("read");
    throw readFailure;
  });
  await expect(
    createCard({ collectionId: crypto.randomUUID(), front: "hello", back: "hallo" }),
  ).rejects.toBe(readFailure);
  expect(query).toHaveBeenLastCalledWith("COMMIT");
  expect(events).toEqual(["release", "read"]);
  expect(query).not.toHaveBeenCalledWith("ROLLBACK");
  expect(client.release).toHaveBeenCalledExactlyOnceWith();
});

it("rolls back and releases when a write fails, without starting a read", async () => {
  const writeFailure = new Error("write unavailable");
  query.mockRejectedValueOnce(writeFailure);
  await expect(
    createCard({ collectionId: crypto.randomUUID(), front: "hello", back: "hallo" }),
  ).rejects.toBe(writeFailure);
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  expect(client.release).toHaveBeenCalledExactlyOnceWith();
  expect(read).not.toHaveBeenCalled();
});
