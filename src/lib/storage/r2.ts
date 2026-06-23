/**
 * R2 storage helpers.
 * - Production (Workers runtime): native R2 binding via getCloudflareContext
 * - Local dev: S3-compatible proxy → remote R2 via REST API
 *
 * Files are always streamed through the app — never exposed via public URLs.
 */

export async function getR2Bucket(): Promise<R2Bucket> {
  if (process.env.NODE_ENV === "development") {
    const { createR2S3Proxy } = await import("./r2-s3-proxy");
    return createR2S3Proxy();
  }

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  return env.R2;
}

export function resumeKey(candidateProfileId: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `resumes/${candidateProfileId}/${sanitized}`;
}

export function companyLogoKey(companyId: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `companies/${companyId}/${sanitized}`;
}

export async function putObject(
  key: string,
  file: ArrayBuffer,
  contentType: string
): Promise<string> {
  const bucket = await getR2Bucket();
  await bucket.put(key, file, { httpMetadata: { contentType } });
  return key;
}

export async function getObject(key: string): Promise<R2ObjectBody | null> {
  const bucket = await getR2Bucket();
  return bucket.get(key);
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = await getR2Bucket();
  await bucket.delete(key);
}
