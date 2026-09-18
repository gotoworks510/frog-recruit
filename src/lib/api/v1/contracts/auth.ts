import { z } from "zod";
import { appVariantSchema, deviceSchema, gatesSchema } from "./common";

export const MIN_PASSWORD_LENGTH = 8;

export const loginRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
  appVariant: appVariantSchema,
  device: deviceSchema,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.enum(["candidate", "employer"]),
  company: z
    .object({ id: z.string(), name: z.string().nullable() })
    .nullable(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
  user: sessionUserSchema,
  gates: gatesSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(400),
});

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().max(320),
  appVariant: appVariantSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(8).max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export const acceptTermsRequestSchema = z.object({
  version: z.string().max(40).optional(),
});

export const meResponseSchema = z.object({
  user: sessionUserSchema,
  gates: gatesSchema,
  unreadNotifications: z.number().int(),
  profile: z
    .object({
      id: z.string(),
      displayName: z.string().nullable(),
      completeness: z.number().int(),
    })
    .nullable(),
});

export const legalDocumentSchema = z.object({
  version: z.string(),
  /** Canonical web page for the document — render in a WebView. */
  url: z.string(),
  /** Inline HTML when available; currently null (the app loads `url`). */
  html: z.string().nullable(),
});
