"use client";
import { useState } from "react";
import { uploadAsset } from "@/lib/assets/asset-client";

// Adaptive Evidence UI (docs/mission-workspace-v2 §6). Branches by `evidence_policy.type` — a real,
// already-filled jsonb field on each Mission (not derived from title, which broke once already this
// session when a Mission got renamed — see lib/stage1-learning-os/passport.ts's fix comment).
// `before_after_photo`/`photo_upload`/`screenshot_upload` upload through the same uploadAsset
// pipeline the Daily Practice Journal already uses (presigned URL, quota, scan — nothing new).
// `checklist_confirmation`/`checkup_review` deliberately never show a file picker — §6 "orientation
// không ép upload file" applies to any policy type that isn't asking for a file. Anything else
// (rubric_submission, document_upload, no type) falls back to the original note+link form.
type SubmitInput = { note?: string; assetId?: string };

export function AdaptiveEvidenceForm({ evidencePolicyType, busy, onSubmit }: {
  evidencePolicyType: string | undefined;
  busy: boolean;
  onSubmit: (input: SubmitInput) => Promise<boolean>;
}) {
  if (evidencePolicyType === "before_after_photo") return <BeforeAfterForm busy={busy} onSubmit={onSubmit} />;
  if (evidencePolicyType === "photo_upload" || evidencePolicyType === "screenshot_upload") return <SinglePhotoForm busy={busy} onSubmit={onSubmit} />;
  if (evidencePolicyType === "checklist_confirmation" || evidencePolicyType === "checkup_review") return <ConfirmationForm busy={busy} onSubmit={onSubmit} />;
  return <NoteAndLinkForm busy={busy} onSubmit={onSubmit} />;
}

function UploadPicker({ label, busy, onUploaded }: { label: string; busy: boolean; onUploaded: (assetId: string, fileName?: string) => void }) {
  const [uploading, setUploading] = useState(false);
  return <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, border: "1px dashed #9aa4b2", padding: "6px 10px", cursor: busy || uploading ? "wait" : "pointer" }}>
    {uploading ? "Đang tải…" : `+ ${label}`}
    <input type="file" accept="image/*,video/mp4" disabled={busy || uploading} style={{ display: "none" }} onChange={async (e) => {
      const file = e.target.files?.[0]; e.target.value = "";
      if (!file) return;
      setUploading(true);
      try { const asset = await uploadAsset(file, { category: "mission-evidence", assetType: file.type.startsWith("video/") ? "video" : "image", compress: file.type.startsWith("image/") }); onUploaded(asset.assetId, asset.fileName); }
      finally { setUploading(false); }
    }} />
  </label>;
}

function NoteAndLinkForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: SubmitInput) => Promise<boolean> }) {
  const [note, setNote] = useState(""); const [link, setLink] = useState("");
  return <>
    <div className="h2o-sr-field"><label>Mô tả bằng chứng</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mô tả bằng chứng đã hoàn thành (ảnh Before/After, ghi chú...)" /></div>
    <div className="h2o-sr-field"><label>Link ảnh / file (tùy chọn)</label>
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Dán link ảnh hoặc file" /></div>
    <div className="h2o-sr-cta">
      <button className="h2o-sr-btn primary" disabled={busy || (!note.trim() && !link.trim())}
        onClick={async () => { const combined = [note.trim(), link.trim()].filter(Boolean).join(" · "); if (await onSubmit({ note: combined })) { setNote(""); setLink(""); } }}>
        Nộp minh chứng
      </button>
    </div>
  </>;
}

function SinglePhotoForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: SubmitInput) => Promise<boolean> }) {
  const [asset, setAsset] = useState<{ id: string; fileName?: string } | null>(null);
  const [note, setNote] = useState("");
  return <>
    <div className="h2o-sr-field"><label>Ảnh / video minh chứng</label>
      {asset ? <span style={{ fontSize: 12 }}>📎 {asset.fileName ?? "Đã chọn tệp"} <button onClick={() => setAsset(null)} style={{ border: "none", background: "none", color: "#b42318", cursor: "pointer" }}>✕</button></span>
        : <UploadPicker label="Chọn ảnh/video" busy={busy} onUploaded={(id, fileName) => setAsset({ id, fileName })} />}
    </div>
    <div className="h2o-sr-field"><label>Ghi chú (tùy chọn)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú thêm nếu cần" /></div>
    <div className="h2o-sr-cta">
      <button className="h2o-sr-btn primary" disabled={busy || !asset} onClick={async () => { if (await onSubmit({ note: note.trim() || undefined, assetId: asset?.id })) { setAsset(null); setNote(""); } }}>Nộp minh chứng</button>
    </div>
  </>;
}

function BeforeAfterForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: SubmitInput) => Promise<boolean> }) {
  const [before, setBefore] = useState<{ id: string; fileName?: string } | null>(null);
  const [after, setAfter] = useState<{ id: string; fileName?: string } | null>(null);
  const [note, setNote] = useState("");
  return <>
    <div className="h2o-sr-field"><label>Ảnh/video Before</label>
      {before ? <span style={{ fontSize: 12 }}>📎 {before.fileName ?? "Đã chọn"} <button onClick={() => setBefore(null)} style={{ border: "none", background: "none", color: "#b42318", cursor: "pointer" }}>✕</button></span>
        : <UploadPicker label="Chọn ảnh/video Before" busy={busy} onUploaded={(id, fileName) => setBefore({ id, fileName })} />}
    </div>
    <div className="h2o-sr-field"><label>Ảnh/video After</label>
      {after ? <span style={{ fontSize: 12 }}>📎 {after.fileName ?? "Đã chọn"} <button onClick={() => setAfter(null)} style={{ border: "none", background: "none", color: "#b42318", cursor: "pointer" }}>✕</button></span>
        : <UploadPicker label="Chọn ảnh/video After" busy={busy} onUploaded={(id, fileName) => setAfter({ id, fileName })} />}
    </div>
    <div className="h2o-sr-field"><label>Ghi chú tự đánh giá</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Điểm đạt / chưa đạt, điều đã cải thiện..." /></div>
    <div className="h2o-sr-cta">
      <button className="h2o-sr-btn primary" disabled={busy || (!before && !after)} onClick={async () => {
        let ok = true;
        if (before) ok = ok && await onSubmit({ note: note.trim() ? `Before · ${note.trim()}` : "Before", assetId: before.id });
        if (after) ok = ok && await onSubmit({ note: note.trim() ? `After · ${note.trim()}` : "After", assetId: after.id });
        if (ok) { setBefore(null); setAfter(null); setNote(""); }
      }}>Nộp minh chứng</button>
    </div>
  </>;
}

function ConfirmationForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: SubmitInput) => Promise<boolean> }) {
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  return <>
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
      <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
      Tôi xác nhận đã hoàn thành đúng nội dung của Mission này.
    </label>
    <div className="h2o-sr-field"><label>Ghi chú (tùy chọn)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú thêm nếu cần" /></div>
    <div className="h2o-sr-cta">
      <button className="h2o-sr-btn primary" disabled={busy || !confirmed} onClick={async () => { if (await onSubmit({ note: note.trim() || "Đã tự xác nhận hoàn thành" })) { setConfirmed(false); setNote(""); } }}>Nộp minh chứng</button>
    </div>
  </>;
}
