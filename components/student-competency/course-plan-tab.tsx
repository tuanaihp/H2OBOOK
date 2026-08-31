"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CURRICULUM_DEFAULTS, SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import styles from "./student-management-workspace.module.css";

type ClassSession = { id: string; sessionNo: number; sessionType: SessionType; title: string; sessionDate: string | null; status: "scheduled" | "completed" | "cancelled" };

export function CoursePlanTab({ classId }: { classId: string }) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  const load = useCallback(async () => {
    const response = await fetch(`/api/teaching/classes/${classId}/sessions`);
    const json = await response.json().catch(() => null);
    if (response.ok) setSessions((json?.sessions ?? []) as ClassSession[]);
    else setMessage(json?.error ?? "Không tải được khung buổi học.");
  }, [classId]);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const result = new Map<SessionType, { created: number; completed: number }>();
    for (const session of sessions) {
      const value = result.get(session.sessionType) ?? { created: 0, completed: 0 };
      value.created += 1; if (session.status === "completed") value.completed += 1; result.set(session.sessionType, value);
    }
    return result;
  }, [sessions]);

  const seed = async () => {
    setSeeding(true); setMessage(null);
    const response = await fetch(`/api/teaching/classes/${classId}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seedCurriculum: true }) });
    const json = await response.json().catch(() => null); setSeeding(false);
    setMessage(response.ok ? (json.count ? `Đã tạo ${json.count} buổi theo khung chuẩn.` : "Lớp đã có đủ khung 60 buổi.") : (json?.error ?? "Không thể khởi tạo chương trình."));
    if (response.ok) await load();
  };

  const update = async (patch: Partial<Pick<ClassSession, "title" | "sessionDate" | "status">>) => {
    if (!selected) return;
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/teaching/classes/${classId}/sessions`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: selected.id, ...patch }) });
    const json = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setMessage(json?.error ?? "Không thể cập nhật buổi học."); return; }
    setSessions((current) => current.map((session) => session.id === selected.id ? json.session : session)); setMessage("Đã cập nhật buổi học.");
  };

  return <section className={styles.section}>
    <div className={styles.sectionHead}><div><h2>Khung chương trình 3 tháng · 60 buổi</h2><p>Tạo, đặt lịch, đặt chủ đề và đánh dấu hoàn thành cho từng buổi.</p></div>{sessions.length === 0 && <button className={styles.primaryButton} disabled={seeding} onClick={() => void seed()}>{seeding ? "Đang tạo…" : "Khởi tạo 60 buổi"}</button>}</div>
    <div className={styles.courseGrid}>{CURRICULUM_DEFAULTS.map((group) => { const value = counts.get(group.type) ?? { created: 0, completed: 0 }; return <article key={group.type} className={styles.courseCard}><span>{SESSION_TYPE_LABEL[group.type]}</span><strong>{group.count}</strong><small>{value.completed}/{group.count} hoàn thành · {value.created}/{group.count} đã tạo</small></article>; })}</div>
    {sessions.length > 0 && <article className={styles.card}><div className={styles.cardHeader}><h2>Quản lý từng buổi</h2><span>{sessions.filter((session) => session.status === "completed").length}/{sessions.length} hoàn thành</span></div><div className={styles.cardBody}>
      <div className={styles.sessionEditor}>
        <label>Buổi học<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">— Chọn buổi —</option>{sessions.map((session) => <option key={session.id} value={session.id}>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</option>)}</select></label>
        <label>Chủ đề<input disabled={!selected} value={selected?.title ?? ""} onChange={(event) => setSessions((current) => current.map((session) => session.id === selectedId ? { ...session, title: event.target.value } : session))} /></label>
        <label>Ngày học<input disabled={!selected} type="date" value={selected?.sessionDate ?? ""} onChange={(event) => setSessions((current) => current.map((session) => session.id === selectedId ? { ...session, sessionDate: event.target.value || null } : session))} /></label>
        <label>Trạng thái<select disabled={!selected} value={selected?.status ?? "scheduled"} onChange={(event) => setSessions((current) => current.map((session) => session.id === selectedId ? { ...session, status: event.target.value as ClassSession["status"] } : session))}><option value="scheduled">Đã lên lịch</option><option value="completed">Hoàn thành</option><option value="cancelled">Hủy</option></select></label>
        <button className={styles.primaryButton} disabled={!selected || saving} onClick={() => selected && void update({ title: selected.title, sessionDate: selected.sessionDate, status: selected.status })}>{saving ? "Đang lưu…" : "Lưu buổi học"}</button>
      </div>{message && <p className={styles.message}>{message}</p>}
    </div></article>}
  </section>;
}
