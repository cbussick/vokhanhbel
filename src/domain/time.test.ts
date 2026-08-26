import { describe, expect, it } from "vitest";
import { shiftCalendarDay, toBerlinDay } from "./time.js";

describe("Berlin calendar days", () => {
  it("reads the Berlin calendar day across both daylight-saving transitions", () => {
    expect(toBerlinDay(new Date("2026-03-28T22:30:00.000Z"))).toBe("2026-03-28");
    expect(toBerlinDay(new Date("2026-03-28T23:30:00.000Z"))).toBe("2026-03-29");
    expect(toBerlinDay(new Date("2026-10-24T21:30:00.000Z"))).toBe("2026-10-24");
    expect(toBerlinDay(new Date("2026-10-24T22:30:00.000Z"))).toBe("2026-10-25");
  });

  it("shifts across month and year boundaries", () => {
    expect(shiftCalendarDay("2026-08-25", -1)).toBe("2026-08-24");
    expect(shiftCalendarDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftCalendarDay("2025-12-31", 1)).toBe("2026-01-01");
  });
});
