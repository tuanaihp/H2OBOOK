"use client";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { AlertTriangle, CheckCircle2, CloudUpload, File, FileImage, FileText, LoaderCircle, Search, ShieldCheck, Upload } from "lucide-react";

type UploadedAsset = { id: string; fileName: string; mimeType: string; sizeBytes: number; key: string; mode: "demo" | "cloud"; createdAt: string; status: string; quarantineStatus: string };

export default function AssetsPage() {
  const workspace = useAppStore(state => state.workspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Chưa có file được tải trong phiên này.");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => assets.filter(asset => asset.fileName.toLowerCase().includes(query.toLowerCase())), [assets, query]);

  const loadAssets = async () => {
    const response = await fetch(`/api/assets?organizationId=${encodeURIComponent(workspace.id)}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setAssets((payload.assets ?? []).map((asset: Record<string, unknown>) => ({
      id: String(asset.id), fileName: String(asset.original_name ?? "asset"), mimeType: String(asset.mime_type ?? ""), sizeBytes: Number(asset.size_bytes ?? 0), key: String(asset.storage_key ?? ""), mode: payload.mode === "cloud" ? "cloud" : "demo", createdAt: String(asset.created_at ?? new Date().toISOString()), status: String(asset.status ?? "ready"), quarantineStatus: String(asset.quarantine_status ?? "clean")
    })));
  };
  useEffect(() => { void loadAssets(); }, [workspace.id]);

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []); if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        setMessage(`Đang kiểm tra và tải ${file.name}...`);
        const presignResponse = await fetch("/api/storage/presign-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: workspace.id, category: "library", fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }) });
        const presign = await presignResponse.json();
        if (!presignResponse.ok) throw new Error(presign.error ?? `Không thể chuẩn bị upload ${file.name}`);
        if (presign.uploadUrl) {
          const upload = await fetch(presign.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
          if (!upload.ok) throw new Error(`R2 upload thất bại: ${upload.status}`);
        }
        const completeResponse = await fetch("/api/storage/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: workspace.id, key: presign.key, fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetType: file.type.startsWith("image/") ? "image" : "document" }) });
        const complete = await completeResponse.json();
        if (!completeResponse.ok && !complete.asset) throw new Error(complete.error ?? "Không thể ghi metadata file.");
        if (complete.scan?.status === "blocked") setMessage(`${file.name} đã bị chặn: ${complete.scan.reason ?? "không đạt kiểm tra an toàn"}`);
        else if (complete.scan?.status === "pending") setMessage(`${file.name} đã tải xong và đang chờ quét an toàn.`);
        else setMessage(`${file.name} đã sẵn sàng sử dụng.`);
      }
      await loadAssets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload gặp lỗi.");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">PRIVATE ASSET LIBRARY</span><h1>Kho tài sản production</h1><p>Tải ảnh, PDF, Word, audio và video qua signed URL; file phải vượt kiểm tra workspace và quét an toàn trước khi tải xuống.</p></div><button className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle className="spin"/> : <Upload/>}Tải file lên</button><input ref={inputRef} hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,.docx,.txt,audio/mpeg,audio/wav,video/mp4" onChange={uploadFiles}/></div>
    <section className="asset-upload-hero"><div><CloudUpload/><h2>Direct-to-R2 Upload</h2><p>H2OBOOK kiểm tra tên, MIME, dung lượng, object thực tế, quyền workspace và trạng thái quét file.</p><div><Badge tone="success"><ShieldCheck/>Private by default</Badge><Badge tone="purple">Max 250 MB</Badge></div></div><div className="asset-upload-status"><CheckCircle2/><span><strong>Trạng thái gần nhất</strong><small>{message}</small></span></div></section>
    <section className="section-card"><div className="section-head"><div><h2>Tài sản của workspace</h2><p>Danh sách được đọc từ PostgreSQL khi chạy Production Mode.</p></div><div className="search-box compact"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên file..."/></div></div><div className="asset-list">{filtered.length ? filtered.map(asset => <article key={asset.id}><span className="asset-file-icon">{asset.mimeType.startsWith("image/") ? <FileImage/> : asset.mimeType.includes("pdf") || asset.mimeType.includes("word") ? <FileText/> : <File/>}</span><div><strong>{asset.fileName}</strong><small>{(asset.sizeBytes / 1024 / 1024).toFixed(2)} MB · {asset.mimeType || "unknown"}</small><code>{asset.key}</code></div><Badge tone={asset.quarantineStatus === "clean" ? "success" : asset.quarantineStatus === "blocked" ? "danger" : "warning"}>{asset.quarantineStatus === "clean" ? "Đã quét" : asset.quarantineStatus === "blocked" ? <><AlertTriangle/>Bị chặn</> : "Chờ quét"}</Badge></article>) : <div className="asset-empty"><CloudUpload/><strong>Chưa có tài sản</strong><p>Tải một file để kiểm tra toàn bộ luồng signed upload.</p></div>}</div></section>
  </AppShell>;
}
