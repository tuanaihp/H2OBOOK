"use client";
import { useEffect, useState } from "react";

type Entry = { id: string; date: string; textNote: string; tags: string[] };
const TAGS = ["Nền", "Mắt", "Mày", "Môi", "Tóc", "Before/After"];

// Daily Practice Journal (docs/stage1-learning-os-v1). Photo/video attachment (learner_notes.asset_ids,
// migration 0055) and teacher review are real schema but have no upload/review UI wired in this pass —
// documented as a deferred gap in docs/stage1-learning-os-v1/FINAL_REPORT.md rather than faked here.
export function DailyPracticeLogger({ missionId }: { missionId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
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

  async function save() {
    if (!note.trim()) return;
    setBusy(true); setMessage(null);
    const res = await fetch("/api/student/practice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId, textNote: note, tags }) });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMessage(json?.error ?? "Không lưu được nhật ký."); return; }
    setNote(""); setTags([]);
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
    {message && <p style={{ fontSize: 11, color: "#b42318", marginTop: 6 }}>{message}</p>}
    <div className="h2o-sr-cta" style={{ marginTop: 8 }}>
      <button className="h2o-sr-btn primary" disabled={busy || !note.trim()} onClick={save}>Lưu nhật ký</button>
    </div>

    {!loading && entries.length > 0 && <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      {entries.map((e) => <div key={e.id} className="h2o-sr-task">
        <span style={{ fontSize: 14 }}>📝</span>
        <div>
          <b>{new Date(e.date).toLocaleDateString("vi-VN")}</b>
          <p>{e.textNote}</p>
          {e.tags.length > 0 && <small>{e.tags.join(" · ")}</small>}
        </div>
        <span />
      </div>)}
    </div>}
  </div>;
}
