import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: input.key, ContentType: input.contentType,
    ContentLength: input.sizeBytes, Metadata: { source: "h2obook" }
  });
  return getSignedUrl(client(), command, { expiresIn: 10 * 60 });
}

export async function createDownloadUrl(key: string, fileName?: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key,
    ResponseContentDisposition: fileName ? `attachment; filename="${fileName.replaceAll('"', '')}"` : undefined
  });
  return getSignedUrl(client(), command, { expiresIn: 5 * 60 });
}

export async function headStoredObject(key: string) {
  const result = await client().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  return { sizeBytes: Number(result.ContentLength ?? 0), contentType: result.ContentType ?? "application/octet-stream", metadata: result.Metadata ?? {} };
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
