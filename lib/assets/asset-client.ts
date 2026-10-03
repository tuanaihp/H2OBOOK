import { readLocalAsset, saveLocalAsset } from "./local-asset-store";

export type UploadedAsset = { assetId: string; previewUrl: string; mode: "local" | "cloud"; storageKey?: string; mimeType?: string; fileName?: string; scanStatus?: string; scanReason?: string; degradedReason?: string };

function localId() { return `local:${crypto.randomUUID()}`; }

const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_OUTPUT_QUALITY = 0.8;
export const PROXY_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/** Re-encodes raster images to WebP at 80% while retaining their original pixel dimensions.
 *  This keeps book pages sharp; the original file is used whenever conversion is not smaller. */
async function compressImageFile(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined" || !COMPRESSIBLE_IMAGE_TYPES.has(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (file.type === "image/webp") { bitmap.close(); return file; }
    const width = bitmap.width;
    const height = bitmap.height;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", IMAGE_OUTPUT_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[a-zA-Z0-9]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function uploadAsset(inputFile: File, input?: { organizationId?: string; category?: string; assetType?: string; metadata?: Record<string, unknown>; checksum?: string; width?: number; height?: number; compress?: boolean }): Promise<UploadedAsset> {
  // Compression is opt-in: Input Engine imports (PDF/Image/HTML/DOCX) rely on exact original
  // pixel dimensions, EXIF and pre-validated magic bytes, so they must never pass compress:true.
  const file = input?.compress ? await compressImageFile(inputFile) : inputFile;
  if (process.env.NEXT_PUBLIC_APP_MODE !== "production") {
    const assetId = localId();
    await saveLocalAsset(assetId, file);
    return { assetId, previewUrl: URL.createObjectURL(file), mode: "local", mimeType: file.type, fileName: file.name };
  }
  // Step-tagged errors: a bare "Failed to fetch" tells nobody which of the four network hops
  // (presign → R2 PUT → proxy fallback → complete) actually died on production.
  try {
  let presign: Response;
  try {
    presign = await fetch("/api/storage/presign-upload", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, organizationId: input?.organizationId, category: input?.category ?? "assets" })
    });
  } catch (error) {
    throw new Error(`PRESIGN_NETWORK: ${error instanceof Error ? error.message : "không kết nối được máy chủ"}`);
  }
  if (!presign.ok) throw new Error(`PRESIGN_${presign.status}: Không thể tạo đường dẫn upload an toàn.`);
  const signed = await presign.json() as { mode: "demo" | "cloud"; key: string; uploadUrl: string | null };
  if (!signed.uploadUrl) {
    const assetId = localId(); await saveLocalAsset(assetId, file);
    return { assetId, previewUrl: URL.createObjectURL(file), mode: "local", mimeType: file.type, fileName: file.name };
  }
  let uploaded: Response | null = null;
  // The current R2 API token cannot administer bucket CORS. Small files therefore use the
  // same-origin proxy immediately instead of producing one failed preflight per page before
  // falling back. Large files still require direct-to-R2 because of the platform body limit.
  if (file.size > PROXY_UPLOAD_MAX_BYTES) {
    try {
      uploaded = await fetch(signed.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    } catch {
      // The explicit error below explains the required bucket CORS repair.
    }
  }
  if (!uploaded?.ok) {
    if (file.size > PROXY_UPLOAD_MAX_BYTES) throw new Error("R2_UPLOAD_FAILED: File cần kết nối trực tiếp R2 — CORS của bucket chưa mở cho tên miền này (chạy scripts/configure-r2-cors.mjs hoặc đặt AllowedOrigins trong Cloudflare Dashboard).");
    let proxied: Response;
    try {
      proxied = await fetch("/api/storage/upload-proxy", {
        method: "POST",
        headers: {
          "content-type": file.type,
          "x-h2obook-file-name": encodeURIComponent(file.name),
          "x-h2obook-size": String(file.size),
          "x-h2obook-storage-key": signed.key,
          ...(input?.organizationId ? { "x-h2obook-organization-id": input.organizationId } : {})
        },
        body: file
      });
    } catch (error) {
      throw new Error(`PROXY_NETWORK: ${error instanceof Error ? error.message : "không kết nối được máy chủ"}`);
    }
    if (!proxied.ok) {
      const error = await proxied.json().catch(() => null) as { error?: string; message?: string } | null;
      throw new Error(error?.message || error?.error || `PROXY_${proxied.status}: Upload file thất bại.`);
    }
  }
  let complete: Response;
  try {
    complete = await fetch("/api/storage/complete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: input?.organizationId, key: signed.key, fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetType: input?.assetType ?? "image", metadata: input?.metadata ?? {}, checksum: input?.checksum, width: input?.width, height: input?.height })
    });
  } catch (error) {
    throw new Error(`COMPLETE_NETWORK: ${error instanceof Error ? error.message : "không kết nối được máy chủ"}`);
  }
  const result = await complete.json().catch(() => null) as { asset?: { id: string; storage_key?: string; mime_type?: string; original_name?: string; quarantine_status?: string }; scan?: { status?: string; reason?: string } } | null;
  // /complete answers 422 with an asset row for a blocked file — surface the scan verdict instead of
  // a bare status code so upload UIs can show why the file was rejected.
  if (!result?.asset) throw new Error(`COMPLETE_${complete.status}: Không thể xác nhận file đã tải lên.`);
  if (result.scan?.status === "blocked") throw new Error(`UPLOAD_BLOCKED: ${result.scan.reason ?? "file không đạt kiểm tra an toàn"}`);
  // Persist a same-origin URL, not a blob: preview. blob: URLs die on navigation/reload and were
  // the reason an imported page still had "1 layer" while its canvas was completely white.
  return { assetId: result.asset.id, previewUrl: `/api/assets/${encodeURIComponent(result.asset.id)}/raw`, mode: "cloud", storageKey: result.asset.storage_key ?? signed.key, mimeType: result.asset.mime_type ?? file.type, fileName: result.asset.original_name ?? file.name, scanStatus: result.scan?.status ?? result.asset.quarantine_status, scanReason: result.scan?.reason };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UPLOAD_FAILED";
    // Content rejections must not silently downgrade to local — the caller needs the verdict.
    if (/^(UPLOAD_BLOCKED|PRESIGN_400|COMPLETE_400)/.test(reason)) throw error;
    // Infrastructure failures (auth expired, workspace missing, presign/proxy/complete down,
    // R2 unreachable or misconfigured) keep the import usable: the asset persists in
    // IndexedDB as local:<id> and resolves via resolveAssetUrl like any demo-mode asset.
    console.warn("[H2OBOOK upload] cloud path failed, storing locally:", reason);
    const assetId = localId();
    await saveLocalAsset(assetId, file);
    return { assetId, previewUrl: URL.createObjectURL(file), mode: "local", mimeType: file.type, fileName: file.name, degradedReason: reason };
  }
}

/** URL a browser can actually render an asset from (<img>, Konva canvas, CSS background).
 *  Cloud assets resolve to our own origin, never to a presigned R2 link: R2 answers a
 *  cross-origin GET without Access-Control-Allow-Origin unless the bucket carries an explicit
 *  CORS rule, so an <img crossOrigin="anonymous"> load silently fails and the page renders
 *  blank — the exact symptom of imported image/PDF book pages showing up empty. The same-origin
 *  route also sidesteps the 5-minute presign expiry during long editing sessions. */
export async function resolveAssetUrl(assetId: string) {
  if (assetId.startsWith("local:")) {
    const blob = await readLocalAsset(assetId);
    return blob ? URL.createObjectURL(blob) : null;
  }
  return `/api/assets/${encodeURIComponent(assetId)}/raw`;
}

/** Presigned, time-limited R2 link with attachment disposition — for "save file" actions only. */
export async function resolveAssetDownloadUrl(assetId: string) {
  if (assetId.startsWith("local:")) {
    const blob = await readLocalAsset(assetId);
    return blob ? URL.createObjectURL(blob) : null;
  }
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/url`, { cache: "no-store" });
  if (!response.ok) {
    // Surface the real failure (401 auth, 403 workspace, 404 missing, 503 no DB) — a bare
    // null leaves blank pages with no diagnosable reason.
    const body = await response.json().catch(() => null) as { error?: string } | null;
    console.warn(`[H2OBOOK] asset url resolve failed: ${assetId} → ${response.status} ${body?.error ?? ""}`.trim());
    return null;
  }
  const payload = await response.json() as { url?: string | null };
  return payload.url ?? null;
}
