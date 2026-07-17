import { z } from "zod";

export const sessionStatusSchema = z.object({ authenticated: z.boolean() });
export const loginInputSchema = z.object({ password: z.string().min(6).max(128) });
