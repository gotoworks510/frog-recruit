/**
 * R2 S3 Proxy — implements a minimal R2Bucket interface using the S3-compatible
 * API. Used in local dev to connect to remote R2 instead of local miniflare.
 *
 * Requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CLOUDFLARE_ACCOUNT_ID in
 * .env.local.
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const BUCKET = "frog-recruit-files";

function getS3Client(): S3Client {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error(
      "R2 S3 Proxy requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CLOUDFLARE_ACCOUNT_ID in .env.local"
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/** Minimal R2Bucket-compatible proxy backed by the S3 API (get/put/delete/head). */
export function createR2S3Proxy(): R2Bucket {
  const client = getS3Client();

  const proxy = {
    async head(key: string): Promise<R2Object | null> {
      try {
        const res = await client.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: key })
        );
        return {
          key,
          size: res.ContentLength ?? 0,
          httpMetadata: {
            contentType: res.ContentType ?? "application/octet-stream",
          },
          etag: res.ETag ?? "",
          version: "",
          uploaded: res.LastModified ?? new Date(),
          httpEtag: res.ETag ?? "",
          checksums: { toJSON: () => ({}) },
          storageClass: "Standard",
          customMetadata: {},
          range: undefined,
          writeHttpMetadata() {},
        } as unknown as R2Object;
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "NotFound") return null;
        throw err;
      }
    },

    async get(
      key: string,
      options?: { range?: { offset: number; length: number } }
    ): Promise<R2ObjectBody | null> {
      try {
        const params: { Bucket: string; Key: string; Range?: string } = {
          Bucket: BUCKET,
          Key: key,
        };

        if (options?.range) {
          const { offset, length } = options.range;
          params.Range = `bytes=${offset}-${offset + length - 1}`;
        }

        const res = await client.send(new GetObjectCommand(params));
        if (!res.Body) return null;

        const webStream = res.Body.transformToWebStream();

        return {
          key,
          size: res.ContentLength ?? 0,
          httpMetadata: {
            contentType: res.ContentType ?? "application/octet-stream",
          },
          etag: res.ETag ?? "",
          version: "",
          uploaded: res.LastModified ?? new Date(),
          httpEtag: res.ETag ?? "",
          checksums: { toJSON: () => ({}) },
          storageClass: "Standard",
          customMetadata: {},
          range: options?.range
            ? {
                offset: options.range.offset,
                end: options.range.offset + options.range.length - 1,
              }
            : undefined,
          body: webStream,
          bodyUsed: false,
          arrayBuffer: () =>
            res.Body!.transformToByteArray().then((b) => b.buffer as ArrayBuffer),
          text: () => res.Body!.transformToString(),
          json: () => res.Body!.transformToString().then(JSON.parse),
          blob: async () => {
            const bytes = await res.Body!.transformToByteArray();
            return new Blob([bytes.buffer as ArrayBuffer]);
          },
          writeHttpMetadata() {},
        } as unknown as R2ObjectBody;
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "NoSuchKey") return null;
        throw err;
      }
    },

    async put(
      key: string,
      body: ReadableStream | ArrayBuffer | string | null,
      options?: { httpMetadata?: { contentType?: string } }
    ): Promise<R2Object> {
      let bodyForUpload: ReadableStream | Buffer | string | undefined;

      if (body instanceof ArrayBuffer) {
        bodyForUpload = Buffer.from(body);
      } else if (typeof body === "string") {
        bodyForUpload = body;
      } else if (body === null) {
        bodyForUpload = undefined;
      } else {
        const reader = (body as ReadableStream).getReader();
        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) chunks.push(result.value);
        }
        bodyForUpload = Buffer.concat(chunks);
      }

      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: bodyForUpload,
          ContentType: options?.httpMetadata?.contentType,
        })
      );

      return {
        key,
        size: 0,
        httpMetadata: {
          contentType:
            options?.httpMetadata?.contentType ?? "application/octet-stream",
        },
        etag: "",
        version: "",
        uploaded: new Date(),
        httpEtag: "",
        checksums: { toJSON: () => ({}) },
        storageClass: "Standard",
        customMetadata: {},
        writeHttpMetadata() {},
      } as unknown as R2Object;
    },

    async delete(key: string | string[]): Promise<void> {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) {
        await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: k }));
      }
    },

    list: () => {
      throw new Error("list() not implemented in R2 S3 proxy");
    },
    createMultipartUpload: () => {
      throw new Error("createMultipartUpload() not implemented in R2 S3 proxy");
    },
    resumeMultipartUpload: () => {
      throw new Error("resumeMultipartUpload() not implemented in R2 S3 proxy");
    },
  };

  return proxy as unknown as R2Bucket;
}
