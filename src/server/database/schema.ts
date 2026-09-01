import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Card } from "../../contracts/card.js";
import { defaultCollectionIcon } from "../../contracts/collection.js";
import { defaultTopicIcon } from "../../contracts/topic.js";

/**
 * Every Card created before Collections existed belongs here, and the column default keeps the
 * previously deployed app writable while the migration runs ahead of the deploy.
 */
export const defaultCollectionId = "00000000-0000-4000-8000-000000000001";

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    icon: text("icon").notNull().default(defaultCollectionIcon),
    /**
     * Nullable and without a default: a Collection that declares no language for a face is the
     * ordinary case, and every Collection that predates these columns already reads that way.
     */
    frontLanguage: text("front_language"),
    backLanguage: text("back_language"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("collections_name_length", sql`char_length(${table.name}) between 1 and 60`),
    // Deliberately a length bound, not a value list: adding an icon stays a code-only change.
    check("collections_icon_length", sql`char_length(${table.icon}) between 1 and 40`),
    // Same reasoning as the icon: adding a supported locale stays a code-only change.
    check(
      "collections_front_language_length",
      sql`${table.frontLanguage} is null or char_length(${table.frontLanguage}) between 2 and 35`,
    ),
    check(
      "collections_back_language_length",
      sql`${table.backLanguage} is null or char_length(${table.backLanguage}) between 2 and 35`,
    ),
    check("collections_name_normalized", sql`${table.name} = normalize_card_text(${table.name})`),
    check("collections_normalized_name_matches", sql`${table.normalizedName} = ${table.name}`),
    uniqueIndex("collections_active_name_unique")
      .on(sql`lower(${table.normalizedName})`)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "restrict", onUpdate: "restrict" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    icon: text("icon").notNull().default(defaultTopicIcon),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("topics_name_length", sql`char_length(${table.name}) between 1 and 60`),
    check("topics_icon_length", sql`char_length(${table.icon}) between 1 and 40`),
    check("topics_name_normalized", sql`${table.name} = normalize_card_text(${table.name})`),
    check("topics_normalized_name_matches", sql`${table.normalizedName} = ${table.name}`),
    uniqueIndex("topics_active_name_unique")
      .on(table.collectionId, sql`lower(${table.normalizedName})`)
      .where(sql`${table.deletedAt} is null`),
    index("topics_collection_active_idx")
      .on(table.collectionId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const audioAssets = pgTable(
  "audio_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    objectKey: text("object_key").notNull().unique(),
    ownerSessionHash: text("owner_session_hash").notNull(),
    contentType: text("content_type").notNull(),
    codec: text("codec").notNull(),
    byteSize: integer("byte_size").notNull(),
    durationMs: integer("duration_ms").notNull(),
    checksum: text("checksum").notNull(),
    stagedUntil: timestamp("staged_until", { withTimezone: true, mode: "date" }).notNull(),
    claimedCardId: uuid("claimed_card_id"),
    claimedFace: text("claimed_face"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("audio_assets_byte_size", sql`${table.byteSize} between 1 and 2000000`),
    check("audio_assets_duration", sql`${table.durationMs} between 1 and 7000`),
    check(
      "audio_assets_claim_shape",
      sql`(${table.claimedCardId} is null and ${table.claimedFace} is null) or (${table.claimedCardId} is not null and ${table.claimedFace} in ('front', 'back'))`,
    ),
    uniqueIndex("audio_assets_claimed_face_unique")
      .on(table.claimedCardId, table.claimedFace)
      .where(sql`${table.claimedCardId} is not null and ${table.deletedAt} is null`),
    index("audio_assets_staged_expiry_idx")
      .on(table.stagedUntil)
      .where(sql`${table.claimedCardId} is null and ${table.deletedAt} is null`),
  ],
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .default(defaultCollectionId)
      .references(() => collections.id, { onDelete: "restrict", onUpdate: "restrict" }),
    frontText: text("front_text"),
    normalizedFront: text("normalized_front"),
    frontAudioId: uuid("front_audio_id").references(() => audioAssets.id, {
      onDelete: "restrict",
      onUpdate: "restrict",
    }),
    backText: text("back_text"),
    backAudioId: uuid("back_audio_id").references(() => audioAssets.id, {
      onDelete: "restrict",
      onUpdate: "restrict",
    }),
    box: integer("box").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check(
      "cards_front_length",
      sql`${table.frontText} is null or char_length(${table.frontText}) between 1 and 1000`,
    ),
    check(
      "cards_back_length",
      sql`${table.backText} is null or char_length(${table.backText}) between 1 and 1000`,
    ),
    check(
      "cards_front_present",
      sql`${table.deletedAt} is not null or ${table.frontText} is not null or ${table.frontAudioId} is not null`,
    ),
    check(
      "cards_back_present",
      sql`${table.deletedAt} is not null or ${table.backText} is not null or ${table.backAudioId} is not null`,
    ),
    check("cards_box_range", sql`${table.box} between 0 and 5`),
    check(
      "cards_front_normalized",
      sql`${table.frontText} is null or ${table.frontText} = normalize_card_text(${table.frontText})`,
    ),
    check(
      "cards_back_normalized",
      sql`${table.backText} is null or ${table.backText} = normalize_card_text(${table.backText})`,
    ),
    check(
      "cards_normalized_front_matches",
      sql`${table.normalizedFront} is not distinct from ${table.frontText}`,
    ),
    uniqueIndex("cards_active_front_unique")
      .on(table.collectionId, sql`digest(lower(${table.normalizedFront}), 'sha256')`)
      .where(sql`${table.deletedAt} is null and ${table.normalizedFront} is not null`),
    index("cards_collection_due_active_idx")
      .on(table.collectionId, table.dueAt)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const cardTopics = pgTable(
  "card_topics",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade", onUpdate: "restrict" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade", onUpdate: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.cardId, table.topicId] }),
    index("card_topics_topic_idx").on(table.topicId),
  ],
);

export const audioCleanupJobs = pgTable(
  "audio_cleanup_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    audioId: uuid("audio_id").notNull(),
    objectKey: text("object_key").notNull(),
    reason: text("reason").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("audio_cleanup_jobs_pending_audio_unique")
      .on(table.audioId)
      .where(sql`${table.completedAt} is null`),
  ],
);

export const audioUploadAttempts = pgTable(
  "audio_upload_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionHash: text("session_hash").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audio_upload_attempts_session_time_idx").on(table.sessionHash, table.attemptedAt),
  ],
);

export const audioPlaybackAttempts = pgTable(
  "audio_playback_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionHash: text("session_hash").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audio_playback_attempts_session_time_idx").on(table.sessionHash, table.attemptedAt),
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
