// Recompresses existing R2 image assets to WebP at 80% quality, in place.
//
// Uploaded objects keep the same storage_key (so every book JSON assetId / element keeps working)
// while the bytes become WebP and the assets row is updated (mime_type, size_bytes, checksum,
// width, height). Only objects whose re-encoded payload is actually smaller are replaced.
//
// Skipped on purpose (mirrors the client-side compress policy):
//   - asset_type "image-source" / "*-source": OCR and document sources need original pixels.
//   - mime_type outside image/jpeg | image/png: already WebP/other, or not a display image.
//   - blocked / deleted rows.
//
// Usage:
//   node scripts/recompress-r2-images.mjs            # dry run — reports what would change
//   node scripts/recompress-r2-images.mjs --apply    # writes WebP bytes back to the same keys
//   node scripts/recompress-r2-images.mjs --apply --book-assets-only
//                                                    # only assets referenced by books' documents
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const SOURCE_ASSET_TYPES = new Set(["image-source", "docx-source", "pdf-source", "html-source", "zip-source", "video"]);
const COMPRESSIBLE_MIME = new Set(["image/jpeg", "image/png"]);
const QUALITY = 80;

function loadLocalEnvironment() {
  let source = "";
  try { source = readFileSync(".env.local", "utf8"); }
  catch { return; }
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function loadSharp() {
  try { return (await import("sharp")).default; }
  catch {
    // sharp ships in the pnpm store via Next.js but is not a direct dependency — fall back to
    // resolving it there so this maintenance script still runs without adding a package dep.
    const { readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const base = join(process.cwd(), "node_modules", ".pnpm");
    const dir = readdirSync(base).find((name) => name.startsWith("sharp@"));
    if (!dir) throw new Error("sharp is not installed — run `pnpm add -D sharp` first");
    return (await import(`file:///${join(base, dir, "node_modules", "sharp", "dist", "index.mjs")}`.replace(/\\/g, "/"))).default;
  }
}

loadLocalEnvironment();
const apply = process.argv.includes("--apply");
const bookAssetsOnly = process.argv.includes("--book-assets-only");

const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") },
});
const bucket = required("R2_BUCKET");
const sharp = await loadSharp();

let assetIdFilter = null;
if (bookAssetsOnly) {
  assetIdFilter = new Set();
  const collect = (node) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "assetId" && typeof value === "string") assetIdFilter.add(value);
      else if (value && typeof value === "object") collect(value);
    }
  };
  const { data: books, error } = await supabase.from("books").select("id,document").is("deleted_at", null);
  if (error) throw error;
  for (const book of books ?? []) collect(book.document);
  console.log(`[recompress] --book-assets-only: ${assetIdFilter.size} assetIds referenced by ${(books ?? []).length} books`);
}

const { data: assets, error } = await supabase
  .from("assets")
  .select("id,organization_id,storage_key,original_name,mime_type,size_bytes,checksum,asset_type,status,quarantine_status,metadata")
  .is("deleted_at", null)
  .in("mime_type", [...COMPRESSIBLE_MIME]);
if (error) throw error;

const candidates = (assets ?? []).filter((asset) =>
  asset.storage_key &&
  !SOURCE_ASSET_TYPES.has(asset.asset_type) &&
  asset.status !== "blocked" &&
  asset.quarantine_status !== "blocked" &&
  (!assetIdFilter || assetIdFilter.has(asset.id)),
);

console.log(`[recompress] ${candidates.length} compressible assets (of ${(assets ?? []).length} image rows scanned)`);

const totals = { processed: 0, skippedSmaller: 0, skippedUnchanged: 0, failed: 0, beforeBytes: 0, afterBytes: 0 };
for (const asset of candidates) {
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: asset.storage_key }));
    const original = Buffer.from(await object.Body.transformToByteArray());
    const pipeline = sharp(original, { failOn: "none" });
    const meta = await pipeline.metadata();
    const webp = await pipeline.webp({ quality: QUALITY }).toBuffer();

    totals.beforeBytes += original.length;
    if (webp.length >= original.length) {
      totals.skippedSmaller += 1;
      totals.afterBytes += original.length;
      console.log(`  skip (not smaller) ${asset.original_name ?? asset.id} ${original.length} -> ${webp.length}`);
      continue;
    }
    totals.afterBytes += webp.length;

    if (apply) {
      await r2.send(new PutObjectCommand({
        Bucket: bucket, Key: asset.storage_key, Body: webp, ContentType: "image/webp",
        CacheControl: "private, max-age=86400, immutable",
      }));
      const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: asset.storage_key }));
      if (head.ContentLength !== webp.length) throw new Error(`verify failed: stored ${head.ContentLength} != ${webp.length}`);
      const checksum = createHash("sha256").update(webp).digest("hex");
      const { error: updateError } = await supabase.from("assets").update({
        mime_type: "image/webp",
        size_bytes: webp.length,
        checksum,
        width: meta.width ?? null,
        height: meta.height ?? null,
        metadata: { ...(asset.metadata ?? {}), recompressed: { from: asset.mime_type, quality: QUALITY, at: new Date().toISOString(), originalBytes: original.length } },
      }).eq("id", asset.id);
      if (updateError) throw updateError;
    }
    totals.processed += 1;
    const saved = ((1 - webp.length / original.length) * 100).toFixed(1);
    console.log(`  ${apply ? "done" : "dry "} ${asset.original_name ?? asset.id} ${(original.length / 1024).toFixed(0)}KB -> ${(webp.length / 1024).toFixed(0)}KB (-${saved}%)`);
  } catch (itemError) {
    totals.failed += 1;
    console.log(`  FAIL ${asset.original_name ?? asset.id}: ${itemError instanceof Error ? itemError.message : itemError}`);
  }
}

const savedMB = ((totals.beforeBytes - totals.afterBytes) / 1024 / 1024).toFixed(1);
console.log(`[recompress] ${apply ? "APPLIED" : "DRY RUN"}: ${totals.processed} compressed, ${totals.skippedSmaller} kept (not smaller), ${totals.failed} failed — ${savedMB}MB ${apply ? "saved" : "would be saved"}`);
if (!apply) console.log("[recompress] run with --apply to write changes");
r2.destroy();
