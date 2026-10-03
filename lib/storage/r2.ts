import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isR2Configured } from "@/lib/runtime-config";

function client() {
  if (!isR2Configured()) throw new Error("R2_NOT_CONFIGURED");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! }
  });
}

export function storageKey(organizationId: string, category: string, fileName: string) {
  const safeCategory = category.replace(/[^a-z0-9_-]/gi, "-");
  const day = new Date().toISOString().slice(0, 10);
  return `${organizationId}/${safeCategory}/${day}/${crypto.randomUUID()}-${fileName}`;
}

export async function createUploadUrl(input: { key: string; contentType: string; sizeBytes: number }) {
  // Keep the presigned command aligned with the browser PUT: it only sends Content-Type explicitly.
  // Extra command headers (x-amz-meta-*, Content-Length) can become signature requirements that a
  // browser cannot replay verbatim, causing R2 to reject the upload with SignatureDoesNotMatch.
  // Size is validated in presign-upload and re-checked from the stored object in /complete.
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: input.key, ContentType: input.contentType
  });
  return getSignedUrl(client(), command, { expiresIn: 10 * 60 });
}

export async function uploadStoredObject(input: { key: string; contentType: string; body: Uint8Array }) {
  await client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.body.byteLength,
    Body: input.body
  }));
}

export async function createDownloadUrl(key: string, fileName?: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key,
    ResponseContentDisposition: fileName ? `attachment; filename="${fileName.replaceAll('"', '')}"` : undefined
  });
  return getSignedUrl(client(), command, { expiresIn: 5 * 60 });
}

// Direct-to-R2 display URL for <img>/canvas — the default render path. Every byte proxied
// through a serverless function counts against the hosting bandwidth quota, so page images
// must flow browser↔R2, never browser↔Vercel↔R2. Inline disposition makes the browser render
// instead of download; the 6-hour expiry survives long editing sessions.
// Caveat: Konva/canvas pixel access still needs the bucket CORS rule (scripts/configure-r2-cors.mjs);
// plain <img> renders cross-origin without it.
export async function createViewUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key, ResponseContentDisposition: "inline"
  });
  return getSignedUrl(client(), command, { expiresIn: 6 * 60 * 60 });
}

export async function headStoredObject(key: string) {
  const result = await client().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  return { sizeBytes: Number(result.ContentLength ?? 0), contentType: result.ContentType ?? "application/octet-stream", metadata: result.Metadata ?? {} };
}

// S3/R2 deletes are idempotent — deleting a missing key succeeds silently, so callers can retry
// cleanup without tracking which objects already went away.
export async function deleteStoredObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
}

export async function readStoredObjectPrefix(key: string, length = 4096) {
  const result = await client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, Range: `bytes=0-${Math.max(0, length - 1)}` }));
  const body = result.Body;
  if (!body) return new Uint8Array();
  if ("transformToByteArray" in body && typeof body.transformToByteArray === "function") return body.transformToByteArray();
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  return merged;
}

export async function readStoredObject(key: string) {
  const result = await client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  const body = result.Body;
  if (!body) return new Uint8Array();
  if ("transformToByteArray" in body && typeof body.transformToByteArray === "function") return body.transformToByteArray();
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  return merged;
}

// LAST-RESORT streaming for <img>/<canvas>: every byte through this helper is billed serverless
// bandwidth. Use only when the direct presigned URL cannot render — i.e. a Konva canvas on a
// bucket that still lacks its CORS rule. The default display path is createViewUrl (browser↔R2).
export async function getStoredObjectStream(key: string) {
  const result = await client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  const body = result.Body as { transformToWebStream?: () => ReadableStream } | undefined;
  if (!body?.transformToWebStream) return null;
  return {
    stream: body.transformToWebStream(),
    contentType: result.ContentType ?? "application/octet-stream",
    contentLength: result.ContentLength,
    etag: result.ETag
  };
}
