import { describe, expect, it } from "vitest";
import { getBoxAfterGrade, getIntervalDays, getPointsForGrade } from "./review";

describe("Review grading", () => {
  it.each([
    ["forgot", 1],
    ["almost", 5],
    ["knew_it", 10],
  ] as const)("awards settled Points for %s", (grade, points) => {
    expect(getPointsForGrade(grade)).toBe(points);
  });

  it("moves Cards through the Leitner boxes", () => {
    expect(getBoxAfterGrade(4, "forgot")).toBe(0);
    expect(getBoxAfterGrade(4, "almost")).toBe(4);
    expect(getBoxAfterGrade(4, "knew_it")).toBe(5);
    expect(getBoxAfterGrade(5, "knew_it")).toBe(5);
  });

  it("maps every Box to its Berlin calendar-day interval", () => {
    expect([0, 1, 2, 3, 4, 5].map(getIntervalDays)).toEqual([1, 3, 7, 14, 30, 90]);
  });
});
