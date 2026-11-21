import { z } from "zod";

export const gradeSchema = z.enum(["forgot", "almost", "knew_it"]);
export type Grade = z.infer<typeof gradeSchema>;

export const boxSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type Box = z.infer<typeof boxSchema>;

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
  if (grade === "forgot") {
    return 0;
  }
  if (grade === "almost") {
    return box;
  }

  const promotedBox = [1, 2, 3, 4, 5, 5] as const;

  return promotedBox[box];
}

export function getIntervalDays(box: number): number {
  const parsedBox = boxSchema.parse(box);

  return intervalDaysByBox[parsedBox];
}
