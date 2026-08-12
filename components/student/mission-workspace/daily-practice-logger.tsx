"use client";
import { useEffect, useState } from "react";
import { resolveAssetUrl, uploadAsset } from "@/lib/assets/asset-client";

type Entry = { id: string; date: string; textNote: string; tags: string[]; assetIds: string[] };
const TAGS = ["Nền", "Mắt", "Mày", "Môi", "Tóc", "Before/After"];
const MAX_ASSETS_PER_ENTRY = 4;

// Daily Practice Journal (docs/stage1-learning-os-v1). Photo/video attach via the existing student
// upload pipeline (lib/assets/asset-client.ts's uploadAsset — same presigned-URL/quota/scan path the
// Reader and Brand Kit already use, role "student" already allowed server-side). Teacher review is
// real schema-adjacent (learner_notes) but out of scope — spec marks it optional ("nếu có").
export function DailyPracticeLogger({ missionId }: { missionId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pendingAssets, setPendingAssets] = useState<{ assetId: string; previewUrl: string; fileName?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/student/practice?missionId=${missionId}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setEntries(json?.entries ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [missionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const room = MAX_ASSETS_PER_ENTRY - pendingAssets.length;
    if (room <= 0) { setMessage(`Tối đa ${MAX_ASSETS_PER_ENTRY} ảnh/video mỗi lần ghi.`); return; }
    setUploading(true); setMessage(null);
    try {
      for (const file of files.slice(0, room)) {
        const asset = await uploadAsset(file, { category: "daily-practice", assetType: file.type.startsWith("video/") ? "video" : "image", compress: file.type.startsWith("image/") });
        setPendingAssets((v) => [...v, { assetId: asset.assetId, previewUrl: asset.previewUrl, fileName: asset.fileName }]);
      }
    } catch {
      setMessage("Tải ảnh/video thất bại — thử lại.");
    } finally {
      setUploading(false);
    }
  }
  function removePendingAsset(assetId: string) { setPendingAssets((v) => v.filter((a) => a.assetId !== assetId)); }

  async function save() {
    if (!note.trim()) return;
    setBusy(true); setMessage(null);
    const res = await fetch("/api/student/practice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId, textNote: note, tags, assetIds: pendingAssets.map((a) => a.assetId) }) });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMessage(json?.error ?? "Không lưu được nhật ký."); return; }
    setNote(""); setTags([]); setPendingAssets([]);
    await load();
  }

  return <div className="h2o-sr-section">
    <h4>Nhật ký thực hành</h4>
    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Hôm nay học gì? Điều gì làm tốt? Điều gì cần sửa?"
      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 13, marginTop: 8 }} />
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {TAGS.map((tag) => <button type="button" key={tag} onClick={() => setTags((v) => v.includes(tag) ? v.filter((x) => x !== tag) : [...v, tag])}
        style={{ borderRadius: 999, border: tags.includes(tag) ? "1px solid #2563eb" : "1px solid #dfe3e8", background: tags.includes(tag) ? "#eff6ff" : "#fff", padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>{tag}</button>)}
    </div>

    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {pendingAssets.map((a) => <span key={a.assetId} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 8, border: "1px solid #dfe3e8", padding: "3px 6px", fontSize: 11 }}>
        📎 {a.fileName ?? "Tệp"}
        <button type="button" onClick={() => removePendingAsset(a.assetId)} aria-label="Bỏ tệp này" style={{ border: "none", background: "none", cursor: "pointer", color: "#b42318", fontSize: 12 }}>✕</button>
      </span>)}
      {pendingAssets.length < MAX_ASSETS_PER_ENTRY && <label style={{ fontSize: 11, borderRadius: 8, border: "1px dashed #9aa4b2", padding: "3px 8px", cursor: uploading ? "wait" : "pointer" }}>
        {uploading ? "Đang tải…" : "+ Ảnh/video"}
        <input type="file" accept="image/*,video/mp4" multiple disabled={uploading} onChange={onPickFiles} style={{ display: "none" }} />
      </label>}
    </div>

    {message && <p style={{ fontSize: 11, color: "#b42318", marginTop: 6 }}>{message}</p>}
    <div className="h2o-sr-cta" style={{ marginTop: 8 }}>
      <button className="h2o-sr-btn primary" disabled={busy || uploading || !note.trim()} onClick={save}>Lưu nhật ký</button>
    </div>

    {!loading && entries.length > 0 && <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      {entries.map((e) => <div key={e.id} className="h2o-sr-task">
        <span style={{ fontSize: 14 }}>📝</span>
        <div>
          <b>{new Date(e.date).toLocaleDateString("vi-VN")}</b>
          <p>{e.textNote}</p>
          {e.tags.length > 0 && <small>{e.tags.join(" · ")}</small>}
          {e.assetIds.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {e.assetIds.map((assetId) => <EntryAssetLink key={assetId} assetId={assetId} />)}
          </div>}
        </div>
        <span />
      </div>)}
    </div>}
  </div>;
}

function EntryAssetLink({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void resolveAssetUrl(assetId).then((u) => { if (!cancelled) setUrl(u); }); return () => { cancelled = true; }; }, [assetId]);
  if (!url) return <small style={{ color: "#9aa4b2" }}>📎 …</small>;
  return <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>📎 Xem tệp</a>;
}
