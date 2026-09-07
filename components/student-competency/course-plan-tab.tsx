"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CURRICULUM_DEFAULTS, SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import { type HolidaySuggestion } from "@/lib/teaching/vietnam-holiday-suggestions";
import { HolidaySuggestionPanel } from "./holiday-suggestion-panel";
import styles from "./student-management-workspace.module.css";

type ClassSession = { id: string; sessionNo: number; sessionType: SessionType; title: string; sessionDate: string | null; status: "scheduled" | "completed" | "cancelled" };

export function CoursePlanTab({ classId }: { classId: string }) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [planStartDate, setPlanStartDate] = useState("");
  const [planEndDate, setPlanEndDate] = useState("");
  const [weekDays, setWeekDays] = useState<number[]>([1, 3, 5]);
  const [planning, setPlanning] = useState(false);
  const [blackouts, setBlackouts] = useState<Array<{ id: string; blackout_date: string; label: string }>>([]);
  const [blackoutDate, setBlackoutDate] = useState("");
  const [blackoutLabel, setBlackoutLabel] = useState("");
  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  const load = useCallback(async () => {
    const response = await fetch(`/api/teaching/classes/${classId}/sessions`);
    const json = await response.json().catch(() => null);
    if (response.ok) setSessions((json?.sessions ?? []) as ClassSession[]);
    else setMessage(json?.error ?? "Không tải được khung buổi học.");
  }, [classId]);
  useEffect(() => { void load(); }, [load]);
  const loadBlackouts = useCallback(async () => { const response = await fetch("/api/teaching/calendar/blackouts"); const json = await response.json().catch(() => null); if (response.ok) setBlackouts(json?.blackouts ?? []); }, []);
  useEffect(() => { void loadBlackouts(); }, [loadBlackouts]);

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

  const distributeSchedule = async () => {
    setPlanning(true); setMessage(null);
    const response = await fetch(`/api/teaching/classes/${classId}/schedule`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ startDate: planStartDate, endDate: planEndDate, weekDays }) });
    const json = await response.json().catch(() => null); setPlanning(false);
    if (!response.ok) { setMessage(json?.error === "SCHEDULE_RANGE_TOO_SHORT" ? `Khoảng ngày chỉ đủ ${json.available}/${json.required} buổi. Hãy tăng thời gian hoặc thêm ngày học.` : (json?.error ?? "Không thể phân lịch tự động.")); return; }
    setMessage(`Đã phân ${json.scheduled} buổi từ ${json.startDate} đến ${json.endDate}. ${json.preservedCompleted} buổi đã hoàn thành/đã hủy được giữ nguyên.`); await load();
  };

  const addBlackout = async () => {
    const response = await fetch("/api/teaching/calendar/blackouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: blackoutDate, label: blackoutLabel }) });
    if (!response.ok) { setMessage("Không thể lưu ngày nghỉ."); return; }
    setBlackoutDate(""); setBlackoutLabel(""); setMessage("Đã thêm ngày nghỉ áp dụng cho mọi lớp."); await loadBlackouts();
  };
  const removeBlackout = async (id: string) => {
    const response = await fetch(`/api/teaching/calendar/blackouts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { setMessage("Không thể xóa ngày nghỉ."); return; }
    await loadBlackouts();
  };
  const applyHolidaySuggestions = async (items: HolidaySuggestion[]) => {
    const response = await fetch("/api/teaching/calendar/blackouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dates: items }) });
    if (!response.ok) { setMessage("Không thể áp dụng gợi ý ngày nghỉ."); return false; }
    setMessage(`Đã thêm ${items.length} ngày nghỉ áp dụng cho mọi lớp.`); await loadBlackouts(); return true;
  };

  return <section className={styles.section}>
    <article className={styles.card}><div className={styles.cardHeader}><h2>Ngày nghỉ toàn Academy</h2><span>Thứ 7 và Chủ nhật mặc định nghỉ</span></div><div className={styles.cardBody}><div className={styles.sessionEditor}><label>Ngày nghỉ<input type="date" value={blackoutDate} onChange={(event) => setBlackoutDate(event.target.value)} /></label><label>Lý do<input value={blackoutLabel} onChange={(event) => setBlackoutLabel(event.target.value)} placeholder="Ví dụ: Quốc khánh" /></label><button className={styles.primaryButton} disabled={!blackoutDate} onClick={() => void addBlackout()}>Thêm ngày nghỉ</button></div><HolidaySuggestionPanel existingDates={blackouts.map((item) => item.blackout_date)} onApply={applyHolidaySuggestions} />{blackouts.length > 0 && <div className={styles.laneList}>{blackouts.map((item) => <div key={item.id} className={styles.laneRow}><strong>{item.blackout_date}</strong><span>{item.label || "Ngày nghỉ Academy"}</span><button type="button" onClick={() => void removeBlackout(item.id)}>Bỏ nghỉ</button></div>)}</div>}</div></article>
    {sessions.length > 0 && <article className={styles.card}><div className={styles.cardHeader}><h2>Tự phân lịch theo tháng</h2><span>Giữ nguyên buổi đã hoàn thành/hủy</span></div><div className={styles.cardBody}><div className={styles.sessionEditor}><label>Ngày bắt đầu<input type="date" value={planStartDate} onChange={(event) => setPlanStartDate(event.target.value)} /></label><label>Ngày kết thúc<input type="date" value={planEndDate} onChange={(event) => setPlanEndDate(event.target.value)} /></label><fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend>Ngày học</legend>{[[1,"T2"],[2,"T3"],[3,"T4"],[4,"T5"],[5,"T6"],[6,"T7"],[0,"CN"]].map(([day,label]) => <label key={String(day)} style={{ display: "inline-flex", marginRight: 8, gap: 3 }}><input type="checkbox" checked={weekDays.includes(day as number)} onChange={() => setWeekDays((current) => current.includes(day as number) ? current.filter((value) => value !== day) : [...current, day as number])} />{label}</label>)}</fieldset><button className={styles.primaryButton} disabled={planning || !planStartDate || !planEndDate || !weekDays.length} onClick={() => void distributeSchedule()}>{planning ? "Đang phân lịch…" : "Tự phân lịch"}</button></div><p className={styles.message}>Các buổi chưa diễn ra được xếp lần lượt vào các ngày đã chọn; lịch học viên cập nhật ngay sau khi lưu.</p></div></article>}
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
