import { and, eq } from "drizzle-orm";
import { devicePushTokens } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import {
  deletePushTokenSchema,
  putPushTokenSchema,
} from "@/lib/api/v1/contracts/notifications";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/** Register / update this device's Expo push token (upsert on user+device). */
export async function PUT(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(request, putPushTokenSchema);
  if (bodyError) return bodyError;

  const now = new Date();
  const existing = await ctx.db
    .select({ id: devicePushTokens.id })
    .from(devicePushTokens)
    .where(
      and(
        eq(devicePushTokens.userId, ctx.user.id),
        eq(devicePushTokens.deviceId, data.deviceId)
      )
    )
    .get();

  if (existing) {
    await ctx.db
      .update(devicePushTokens)
      .set({
        expoPushToken: data.expoPushToken,
        enabled: data.enabled,
        appVariant: ctx.session.appVariant,
        // A fresh token clears a previous DeviceNotRegistered.
        invalidatedAt: null,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(devicePushTokens.id, existing.id));
  } else {
    await ctx.db.insert(devicePushTokens).values({
      userId: ctx.user.id,
      appVariant: ctx.session.appVariant,
      deviceId: data.deviceId,
      expoPushToken: data.expoPushToken,
      enabled: data.enabled,
      createdAt: now,
      updatedAt: now,
    });
  }

  return jsonOk({ ok: true });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    deletePushTokenSchema
  );
  if (bodyError) return bodyError;

  await ctx.db
    .delete(devicePushTokens)
    .where(
      and(
        eq(devicePushTokens.userId, ctx.user.id),
        eq(devicePushTokens.deviceId, data.deviceId)
      )
    );

  return jsonOk({ ok: true });
}
