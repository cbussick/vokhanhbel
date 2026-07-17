import { z } from "zod";
import { berlinDateSchema } from "./common";

export const statsSchema = z.object({
  totalPoints: z.number().int().nonnegative(),
  activeCardCount: z.number().int().nonnegative(),
  reviewsThisWeek: z.number().int().nonnegative(),
  bestDay: z
    .object({ date: berlinDateSchema, reviewCount: z.number().int().positive() })
    .nullable(),
  dailyRecap: z
    .object({
      period: z.enum(["today", "yesterday"]),
      date: berlinDateSchema,
      reviewCount: z.number().int().positive(),
      knewItCount: z.number().int().nonnegative(),
    })
    .nullable(),
});
export type Stats = z.infer<typeof statsSchema>;
