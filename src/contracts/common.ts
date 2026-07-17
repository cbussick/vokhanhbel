import { z } from "zod";

export const uuidSchema = z.uuid();
export const utcTimestampSchema = z.iso.datetime({ offset: false });
export const berlinDateSchema = z.iso.date();
