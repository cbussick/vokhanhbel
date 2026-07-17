import { z } from "zod";

export const gradeSchema = z.enum(["forgot", "almost", "knew_it"]);
export type Grade = z.infer<typeof gradeSchema>;

export const boxSchema = z.number().int().min(0).max(5);
export type Box = 0 | 1 | 2 | 3 | 4 | 5;

export const reviewSessionSize = 10;

const pointsByGrade = {
  forgot: 1,
  almost: 5,
  knew_it: 10,
} as const satisfies Record<Grade, number>;

const intervalDaysByBox = [1, 3, 7, 14, 30, 90] as const;

export function getPointsForGrade(grade: Grade): number {
  return pointsByGrade[grade];
}

export function getBoxAfterGrade(box: Box, grade: Grade): Box {
  if (grade === "forgot") return 0;
  if (grade === "almost") return box;

  return Math.min(box + 1, 5) as Box;
}

export function getIntervalDays(box: number): number {
  const parsedBox = boxSchema.parse(box) as Box;

  return intervalDaysByBox[parsedBox];
}
