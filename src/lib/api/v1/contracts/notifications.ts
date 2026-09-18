import { z } from "zod";
import { NOTIFICATION_KINDS } from "@/lib/notify/events";
import { paginationQuerySchema } from "./common";

export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);

export const notificationsQuerySchema = paginationQuerySchema;

export const notificationSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  data: z.record(z.string()).nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int(),
});

export const markReadRequestSchema = z.union([
  z.object({ ids: z.array(z.string().max(60)).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
]);

export const preferenceSchema = z.object({
  kind: notificationKindSchema,
  label: z.string(),
  description: z.string(),
  pushEnabled: z.boolean(),
});

export const preferencesResponseSchema = z.object({
  preferences: z.array(preferenceSchema),
});

export const setPreferenceRequestSchema = z.object({
  kind: notificationKindSchema,
  pushEnabled: z.boolean(),
});

export const putPushTokenSchema = z.object({
  deviceId: z.string().min(1).max(200),
  expoPushToken: z.string().min(10).max(300),
  enabled: z.boolean().default(true),
});

export const deletePushTokenSchema = z.object({
  deviceId: z.string().min(1).max(200),
});
