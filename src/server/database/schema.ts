import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Card } from "../../contracts/card";

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    front: text("front").notNull(),
    normalizedFront: text("normalized_front").notNull(),
    back: text("back").notNull(),
    box: integer("box").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("cards_front_length", sql`char_length(${table.front}) between 1 and 200`),
    check("cards_back_length", sql`char_length(${table.back}) between 1 and 1000`),
    check("cards_box_range", sql`${table.box} between 0 and 5`),
    check("cards_front_normalized", sql`${table.front} = normalize_card_text(${table.front})`),
    check("cards_back_normalized", sql`${table.back} = normalize_card_text(${table.back})`),
    check("cards_normalized_front_matches", sql`${table.normalizedFront} = ${table.front}`),
    uniqueIndex("cards_active_front_unique")
      .on(sql`lower(${table.normalizedFront})`)
      .where(sql`${table.deletedAt} is null`),
    index("cards_due_active_idx")
      .on(table.dueAt)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "restrict", onUpdate: "restrict" }),
    grade: text("grade").notNull(),
    pointsAwarded: integer("points_awarded").notNull(),
    boxBefore: integer("box_before").notNull(),
    boxAfter: integer("box_after").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    resultCard: jsonb("result_card").$type<Card>().notNull(),
  },
  (table) => [
    check("reviews_grade_value", sql`${table.grade} in ('forgot', 'almost', 'knew_it')`),
    check("reviews_points_value", sql`${table.pointsAwarded} in (1, 5, 10)`),
    check("reviews_box_before_range", sql`${table.boxBefore} between 0 and 5`),
    check("reviews_box_after_range", sql`${table.boxAfter} between 0 and 5`),
    index("reviews_reviewed_at_idx").on(table.reviewedAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    identifierHash: text("identifier_hash").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("sessions_expires_at_idx").on(table.expiresAt)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ipHash: text("ip_hash").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("login_attempts_ip_time_idx").on(table.ipHash, table.attemptedAt)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionHash: text("session_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_usage_session_time_idx").on(table.sessionHash, table.usedAt),
    index("ai_usage_time_idx").on(table.usedAt),
  ],
);
