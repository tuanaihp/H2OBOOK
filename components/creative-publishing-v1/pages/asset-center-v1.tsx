"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, File, FileImage, FileText, LoaderCircle, Search, ShieldCheck, Upload } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import { CreativePageFrame, EmptyPanel, StatusPill, SurfaceCard, styles } from "../creative-shared";

type UploadedAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  key: string;
  quarantineStatus: string;
};

type AssetApiItem = {
  id?: string;
  original_name?: string;
  mime_type?: string;
  size_bytes?: number;
  storage_key?: string;
  quarantine_status?: string;
};

export function AssetCenterV1() {
  const workspace = useAppStore((state) => state.workspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Chưa có file được tải trong phiên này.");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => assets.filter((asset) => asset.fileName.toLowerCase().includes(query.toLowerCase())), [assets, query]);

  const loadAssets = async () => {
    try {
      const response = await fetch(`/api/assets?organizationId=${encodeURIComponent(workspace.id)}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { assets?: AssetApiItem[] };
      setAssets((payload.assets ?? []).map((asset) => ({
        id: String(asset.id ?? crypto.randomUUID()),
        fileName: String(asset.original_name ?? "asset"),
        mimeType: String(asset.mime_type ?? "application/octet-stream"),
        sizeBytes: Number(asset.size_bytes ?? 0),
        key: String(asset.storage_key ?? ""),
        quarantineStatus: String(asset.quarantine_status ?? "clean"),
      })));
    } catch {
      setMessage("Không thể đọc asset cloud. Preview vẫn hoạt động ở chế độ local.");
    }
  };

  useEffect(() => { void loadAssets(); }, [workspace.id]);

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    emitCreativeEvent({ name: "creative_job_started", surface: "assets", action: "upload", metadata: { count: files.length } });
    try {
      for (const file of files) {
        setMessage(`Đang kiểm tra và tải ${file.name}...`);
        const presignResponse = await fetch("/api/storage/presign-upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId: workspace.id, category: "library", fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }),
        });
        const presign = await presignResponse.json() as { error?: string; uploadUrl?: string; key?: string };
        if (!presignResponse.ok || !presign.key) throw new Error(presign.error ?? `Không thể chuẩn bị upload ${file.name}`);
        if (presign.uploadUrl) {
          const upload = await fetch(presign.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
          if (!upload.ok) throw new Error(`R2 upload thất bại: ${upload.status}`);
        }
        const completeResponse = await fetch("/api/storage/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId: workspace.id, key: presign.key, fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetType: file.type.startsWith("image/") ? "image" : "document" }),
        });
        const complete = await completeResponse.json() as { error?: string; scan?: { status?: string; reason?: string } };
        if (!completeResponse.ok) throw new Error(complete.error ?? "Không thể ghi metadata file.");
        if (complete.scan?.status === "blocked") setMessage(`${file.name} bị chặn: ${complete.scan.reason ?? "không đạt kiểm tra an toàn"}`);
        else if (complete.scan?.status === "pending") setMessage(`${file.name} đã tải và đang chờ quét.`);
        else setMessage(`${file.name} đã sẵn sàng sử dụng.`);
      }
      await loadAssets();
      emitCreativeEvent({ name: "creative_job_completed", surface: "assets", action: "upload", metadata: { count: files.length } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload gặp lỗi.";
      setMessage(errorMessage);
      emitCreativeEvent({ name: "creative_job_failed", surface: "assets", action: "upload", metadata: { message: errorMessage } });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return <CreativePageFrame
    active="assets"
    eyebrow="PRIVATE ASSET LIBRARY"
    title="Kho tài sản production"
    description="Một asset ID dùng xuyên suốt Ingestion, Editor, Template, Clone và Publishing."
    actions={<><button className={styles.secondaryButton} onClick={() => void loadAssets()}>Làm mới</button><button className={styles.primaryButton} disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle className={styles.spin}/> : <Upload/>}Tải file lên</button><input ref={inputRef} hidden multiple type="file" onChange={uploadFiles}/></>}
    metrics={[
      { label: "Tài sản", value: assets.length, detail: "trong workspace" },
      { label: "Đã quét", value: assets.filter((item) => item.quarantineStatus === "clean").length },
      { label: "Giới hạn", value: "250 MB", detail: "mỗi file" },
      { label: "Quyền", value: "Private", detail: "mặc định" },
    ]}
  >
    <SurfaceCard title="Direct-to-R2 Upload" description="Signed URL, MIME validation, workspace authorization và quarantine scan." icon={<CloudUpload/>} tone="gradient">
      <div className={styles.inlineBadges}><StatusPill tone="success"><ShieldCheck/>Private by default</StatusPill><StatusPill tone="info">Asset ID dùng chung</StatusPill></div>
      <div className={styles.callout}><CheckCircle2/><div><strong>Trạng thái gần nhất</strong><p>{message}</p></div></div>
    </SurfaceCard>
    <SurfaceCard title="Tài sản của workspace" description="Tìm kiếm theo tên, loại file và trạng thái an toàn.">
      <div className={styles.toolbar}><label className={styles.search}><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên file..."/></label></div>
      {filtered.length ? <div className={styles.list}>{filtered.map((asset) => {
        const Icon = asset.mimeType.startsWith("image/") ? FileImage : asset.mimeType.includes("pdf") || asset.mimeType.includes("word") ? FileText : File;
        return <article key={asset.id} className={styles.listRow}><span className={styles.rowIcon}><Icon/></span><div className={styles.rowMain}><strong>{asset.fileName}</strong><small>{(asset.sizeBytes / 1024 / 1024).toFixed(2)} MB · {asset.mimeType}</small><code>{asset.key}</code></div><StatusPill tone={asset.quarantineStatus === "clean" ? "success" : asset.quarantineStatus === "blocked" ? "danger" : "warning"}>{asset.quarantineStatus === "blocked" ? <><AlertTriangle/>Bị chặn</> : asset.quarantineStatus === "clean" ? "Đã quét" : "Chờ quét"}</StatusPill></article>;
      })}</div> : <EmptyPanel title="Chưa có tài sản" description="Tải một file để kiểm tra luồng signed upload và scan."/>}
    </SurfaceCard>
  </CreativePageFrame>;
}
