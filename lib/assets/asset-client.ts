import { readLocalAsset, saveLocalAsset } from "./local-asset-store";

export type UploadedAsset = { assetId: string; previewUrl: string; mode: "local" | "cloud"; storageKey?: string; mimeType?: string; fileName?: string; scanStatus?: string };

function localId() { return `local:${crypto.randomUUID()}`; }

export async function uploadAsset(file: File, input?: { organizationId?: string; category?: string; assetType?: string; metadata?: Record<string, unknown>; checksum?: string; width?: number; height?: number }): Promise<UploadedAsset> {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "production") {
    const assetId = localId();
    await saveLocalAsset(assetId, file);
    return { assetId, previewUrl: URL.createObjectURL(file), mode: "local", mimeType: file.type, fileName: file.name };
  }
  const presign = await fetch("/api/storage/presign-upload", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, organizationId: input?.organizationId, category: input?.category ?? "assets" })
  });
  if (!presign.ok) throw new Error("Không thể tạo đường dẫn upload an toàn.");
  const signed = await presign.json() as { mode: "demo" | "cloud"; key: string; uploadUrl: string | null };
  if (!signed.uploadUrl) {
    const assetId = localId(); await saveLocalAsset(assetId, file);
    return { assetId, previewUrl: URL.createObjectURL(file), mode: "local", mimeType: file.type, fileName: file.name };
  }
  const uploaded = await fetch(signed.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!uploaded.ok) throw new Error("Upload file thất bại.");
  const complete = await fetch("/api/storage/complete", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: input?.organizationId, key: signed.key, fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetType: input?.assetType ?? "image", metadata: input?.metadata ?? {}, checksum: input?.checksum, width: input?.width, height: input?.height })
  });
  if (!complete.ok) throw new Error("Không thể xác nhận file đã tải lên.");
  const result = await complete.json() as { asset: { id: string; storage_key?: string; mime_type?: string; original_name?: string; quarantine_status?: string }; scan?: { status?: string } };
  return { assetId: result.asset.id, previewUrl: URL.createObjectURL(file), mode: "cloud", storageKey: result.asset.storage_key ?? signed.key, mimeType: result.asset.mime_type ?? file.type, fileName: result.asset.original_name ?? file.name, scanStatus: result.scan?.status ?? result.asset.quarantine_status };
}

export async function resolveAssetUrl(assetId: string) {
  if (assetId.startsWith("local:")) {
    const blob = await readLocalAsset(assetId);
    return blob ? URL.createObjectURL(blob) : null;
  }
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/url`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json() as { url?: string | null };
  return payload.url ?? null;
}
