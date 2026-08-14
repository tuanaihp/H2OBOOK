"use client";
import { useEffect, useState } from "react";
import { resolveAssetUrl, uploadAsset } from "@/lib/assets/asset-client";
import { JOURNEY_SKILLS } from "@/lib/learning-journey/skill-taxonomy";

interface Entry {
  id: string; journeyDay: number | null; practicedToday: string; bestResult: string; problemText: string;
  suspectedReason: string; nextAction: string; practiceMinutes: number | null; selfScore: number | null;
  instructorScore: number | null; instructorFeedback: string | null; assetIds: string[]; skillKeys: string[]; createdAt: string;
}
const MAX_ASSETS_PER_ENTRY = 4;

/**
 * Daily Practice Journal / Learning Journey Intelligence V1 (docs/H2O_LEARNING_JOURNEY_AUDIT.md).
 * Posts to /api/student/learning-journey/log (learner_experiences-backed), not the folder-36
 * facade /api/student/practice — that route stays intact for anyone still calling its narrower
 * shape, this component now speaks the richer V1 contract directly. Photo/video attach reuses the
 * same student upload pipeline as before (lib/assets/asset-client.ts's uploadAsset).
 */
export function DailyPracticeLogger({ missionId }: { missionId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [practicedToday, setPracticedToday] = useState("");
  const [bestResult, setBestResult] = useState("");
  const [problemText, setProblemText] = useState("");
  const [suspectedReason, setSuspectedReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [selfScore, setSelfScore] = useState(70);
  const [practiceMinutes, setPracticeMinutes] = useState<string>("");
  const [skillKeys, setSkillKeys] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [pendingAssets, setPendingAssets] = useState<{ assetId: string; previewUrl: string; fileName?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/student/learning-journey/log?missionId=${missionId}`, { cache: "no-store" });
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
  function toggleSkill(key: string) { setSkillKeys((v) => v.includes(key) ? v.filter((x) => x !== key) : [...v, key]); }

  async function save() {
    if (!practicedToday.trim()) return;
    setBusy(true); setMessage(null);
    const res = await fetch("/api/student/learning-journey/log", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        missionId, practicedToday, bestResult, problemText, suspectedReason, nextAction,
        selfScore, practiceMinutes: practiceMinutes ? Number(practiceMinutes) : undefined,
        skillKeys, assetIds: pendingAssets.map((a) => a.assetId)
      })
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMessage(json?.error ?? "Không lưu được nhật ký."); return; }
    setPracticedToday(""); setBestResult(""); setProblemText(""); setSuspectedReason(""); setNextAction("");
    setSelfScore(70); setPracticeMinutes(""); setSkillKeys([]); setPendingAssets([]); setShowMore(false);
    await load();
  }

  return <div className="h2o-sr-section">
    <h4>Nhật ký thực hành</h4>
    <textarea value={practicedToday} onChange={(e) => setPracticedToday(e.target.value)} rows={3} placeholder="Hôm nay thực hành gì?"
      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 13, marginTop: 8 }} />

    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {JOURNEY_SKILLS.map((skill) => <button type="button" key={skill.key} onClick={() => toggleSkill(skill.key)}
        style={{ borderRadius: 999, border: skillKeys.includes(skill.key) ? "1px solid #2563eb" : "1px solid #dfe3e8", background: skillKeys.includes(skill.key) ? "#eff6ff" : "#fff", padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>{skill.label}</button>)}
    </div>

    <div style={{ marginTop: 10 }}>
      <label style={{ fontSize: 11, color: "#667085" }}>Tự chấm điểm hôm nay: <b>{selfScore}</b>/100</label>
      <input type="range" min={0} max={100} value={selfScore} onChange={(e) => setSelfScore(Number(e.target.value))} style={{ width: "100%" }} />
    </div>

    {!showMore && <button type="button" onClick={() => setShowMore(true)} style={{ marginTop: 8, fontSize: 11, border: "none", background: "none", color: "#2563eb", cursor: "pointer", padding: 0 }}>+ Thêm chi tiết (điều tốt nhất, điều chưa tốt, thời gian…)</button>}

    {showMore && <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
      <textarea value={bestResult} onChange={(e) => setBestResult(e.target.value)} rows={2} placeholder="Điều làm tốt nhất hôm nay?"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 13 }} />
      <textarea value={problemText} onChange={(e) => setProblemText(e.target.value)} rows={2} placeholder="Điều gì chưa tốt / cần sửa?"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 13 }} />
      <textarea value={suspectedReason} onChange={(e) => setSuspectedReason(e.target.value)} rows={2} placeholder="Nguyên nhân, nếu biết?"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 13 }} />
      <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} rows={2} placeholder="Việc cần làm tiếp theo?"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 13 }} />
      <input type="number" min={0} value={practiceMinutes} onChange={(e) => setPracticeMinutes(e.target.value)} placeholder="Số phút đã luyện tập"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 13 }} />
    </div>}

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
      <button className="h2o-sr-btn primary" disabled={busy || uploading || !practicedToday.trim()} onClick={save}>Lưu nhật ký</button>
    </div>

    {!loading && entries.length > 0 && <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      {entries.map((e) => <div key={e.id} className="h2o-sr-task">
        <span style={{ fontSize: 14 }}>📝</span>
        <div>
          <b>{new Date(e.createdAt).toLocaleDateString("vi-VN")}{e.journeyDay ? ` · Ngày ${e.journeyDay}/90` : ""}{e.selfScore != null ? ` · Tự chấm ${e.selfScore}/100` : ""}</b>
          <p>{e.practicedToday}</p>
          {e.bestResult && <small>✓ Tốt nhất: {e.bestResult}</small>}
          {e.problemText && <small>△ Chưa tốt: {e.problemText}</small>}
          {e.instructorFeedback && <small>👩‍🏫 Giáo viên: {e.instructorFeedback}{e.instructorScore != null ? ` (${e.instructorScore}/100)` : ""}</small>}
          {e.skillKeys.length > 0 && <small>{e.skillKeys.map((k) => JOURNEY_SKILLS.find((s) => s.key === k)?.label ?? k).join(" · ")}</small>}
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
