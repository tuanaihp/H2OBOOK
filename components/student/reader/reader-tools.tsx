"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";

type MissionContext = { missionId: string; missionTitle: string; expectedResult: string; returnTo: string };

/**
 * The interactive half of the Contextual Resource Reader (v5/32-.../MissionResourceReader.tsx):
 * bookmark, a note saved into "Học & ghi nhớ", and — only when opened from a Mission —
 * "Đã hiểu – tiếp tục Mission". H2O Mentor's contextual ask is not built (Release 4 boundary, same
 * as every other AI slot in this project) — shown as the same honest unavailable placeholder.
 */
export function ReaderTools({ resourceType, resourceId, initialBookmarked, missionContext }: {
  resourceType: string; resourceId: string; initialBookmarked: boolean; missionContext: MissionContext | null;
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    await fetch("/api/student/reader/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resourceType, resourceId, bookmarked: next }) }).catch(() => {});
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true); setMessage(null);
    const res = await fetch("/api/student/reader/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resourceType, resourceId, missionId: missionContext?.missionId ?? null, body: note.trim() }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) { setMessage("Đã lưu vào Học & ghi nhớ."); setNote(""); } else setMessage("Lưu ghi chú thất bại — thử lại.");
  }

  async function markUnderstoodAndContinue() {
    setBusy(true);
    await fetch("/api/student/reader/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resourceType, resourceId, progressPercent: 100, missionId: missionContext?.missionId ?? null }) }).catch(() => {});
    router.push(missionContext?.returnTo ?? "/student/library");
  }

  return <>
    <button onClick={toggleBookmark} className="h2o-sr-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {bookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {bookmarked ? "Đã lưu" : "Lưu"}
    </button>

    <aside className="h2o-sr-panel" style={{ padding: 16, marginTop: 16 }}>
      <div className="h2o-sr-eyebrow" style={{ fontSize: 10 }}>Ghi chú học tập</div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi lại điều quan trọng..." style={{ width: "100%", minHeight: 100, marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid var(--student-line)", font: "inherit", fontSize: 13 }} />
      <button onClick={saveNote} disabled={busy || !note.trim()} className="h2o-sr-btn primary" style={{ width: "100%", marginTop: 8 }}>Lưu vào Học &amp; ghi nhớ</button>
      {message && <p style={{ fontSize: 11, color: "#718092", marginTop: 6 }}>{message}</p>}
    </aside>

    <aside className="h2o-sr-panel" style={{ padding: 16, marginTop: 12 }}>
      <div className="h2o-sr-eyebrow" style={{ fontSize: 10 }}>H2O Mentor</div>
      <p style={{ fontSize: 12, color: "#718092", margin: "8px 0 0" }}>H2O Mentor tạm thời không khả dụng.</p>
    </aside>

    {missionContext && <section className="h2o-sr-panel" style={{ padding: 16, marginTop: 20, background: "#f7f9fb" }}>
      <div className="h2o-sr-eyebrow" style={{ fontSize: 10 }}>Bạn đọc tài liệu này để</div>
      <p style={{ margin: "6px 0 0", fontWeight: 700, fontSize: 14 }}>{missionContext.expectedResult || missionContext.missionTitle}</p>
      <button onClick={markUnderstoodAndContinue} disabled={busy} className="h2o-sr-btn primary" style={{ marginTop: 12 }}>Đã hiểu – tiếp tục Mission →</button>
    </section>}
  </>;
}
