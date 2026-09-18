import type { z } from "zod";
import { badRequest, validationError } from "./errors";

export type ParsedBody<T> =
  | { data: T; error: null }
  | { data: null; error: Response };

/** Read + validate a JSON body. Handlers must parse before doing any work. */
export async function readJson<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<ParsedBody<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { data: null, error: badRequest("Expected a JSON body.") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { data: null, error: validationError(result.error.issues) };
  }
  return { data: result.data, error: null };
}

/** Validate query params from the request URL. */
export function readQuery<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): ParsedBody<z.infer<S>> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    return { data: null, error: validationError(result.error.issues) };
  }
  return { data: result.data, error: null };
}
