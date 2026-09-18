import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const APP_VARIANTS = ["candidate", "employer"] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

export const mobileSessions = sqliteTable(
  "mobile_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appVariant: text("app_variant", { enum: APP_VARIANTS }).notNull(),
    deviceId: text("device_id").notNull(),
    deviceName: text("device_name"),
    appVersion: text("app_version"),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    previousTokenHash: text("previous_token_hash"),
    previousGraceUntil: integer("previous_grace_until", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    revokedReason: text("revoked_reason"),
  },
  (t) => [
    index("idx_msess_user").on(t.userId),
    index("idx_msess_prev").on(t.previousTokenHash),
  ]
);

export const devicePushTokens = sqliteTable(
  "device_push_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appVariant: text("app_variant", { enum: APP_VARIANTS }).notNull(),
    deviceId: text("device_id").notNull(),
    expoPushToken: text("expo_push_token").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    invalidatedAt: integer("invalidated_at", { mode: "timestamp" }),
    lastError: text("last_error"),
  },
  (t) => [uniqueIndex("uq_push_user_device").on(t.userId, t.deviceId)]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    dataJson: text("data_json"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    readAt: integer("read_at", { mode: "timestamp" }),
    pushedAt: integer("pushed_at", { mode: "timestamp" }),
    pushStatus: text("push_status"),
  },
  (t) => [
    uniqueIndex("uq_notif_user_dedupe").on(t.userId, t.dedupeKey),
    index("idx_notif_user_created").on(t.userId, t.createdAt),
  ]
);

export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    pushEnabled: integer("push_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })]
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    appVariant: text("app_variant", { enum: APP_VARIANTS }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_pwreset_user").on(t.userId)]
);
