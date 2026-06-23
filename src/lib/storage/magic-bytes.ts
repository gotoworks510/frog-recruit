/**
 * Magic-byte validation. v1 restricts resume uploads to PDF only so the
 * watermark path is uniform; this verifies declared content actually is a PDF.
 */

interface MagicByteRule {
  readonly mimeType: string;
  readonly bytes: readonly number[];
  readonly offset?: number;
}

const MAGIC_BYTE_RULES: readonly MagicByteRule[] = [
  // PDF (%PDF-)
  { mimeType: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // PNG
  { mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // JPEG
  { mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
] as const;

const INVALID_FILE_ERROR = "許可されていないファイル形式です";

/**
 * Validate that file content's magic bytes match the declared MIME type.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateMagicBytes(
  buffer: ArrayBuffer,
  declaredMimeType: string
): string | null {
  const matchingRules = MAGIC_BYTE_RULES.filter(
    (rule) => rule.mimeType === declaredMimeType
  );

  if (matchingRules.length === 0) {
    return INVALID_FILE_ERROR;
  }

  const view = new Uint8Array(buffer);

  const isValid = matchingRules.some((rule) => {
    const offset = rule.offset ?? 0;
    if (view.length < offset + rule.bytes.length) return false;
    return rule.bytes.every((byte, i) => view[offset + i] === byte);
  });

  return isValid ? null : INVALID_FILE_ERROR;
}
