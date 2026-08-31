"use client";

import { useState } from "react";
import { ClipboardCheck, Users } from "lucide-react";
import styles from "@/components/operations/operations.module.css";

interface RosterMember { studentId: string; name: string; avatarUrl: string | null; joinedAt: string | null; status: string }
interface StudentCandidate { studentId: string; name: string; email: string; enrolled: boolean; entitlementCount: number }
interface StudentDetail {
  studentId: string; name: string; email: string; phone: string; joinedAt: string | null; completedSessions: number; totalSessions: number; evaluationCount: number; avgScore: number;
  graduation: { graduationStatus: "graduated" | "not_ready"; passingEvaluationRatio: number } | null;
  competency: { key: string; label: string; latestScore: number | null }[] | null;
  sessionHistory: { id: string; sessionNo: number; sessionType: string; title: string; sessionDate: string | null; status: string; evaluated: boolean; score: number | null }[];
  evaluations: { id: string; sessionNo: number; sessionTitle: string; totalScore: number; maxScore: number; notes: string; evidenceCount: number; updatedAt: string }[];
}

export function RosterTab({ classId, roster, candidates, loading, selectedStudentId, onSelect, onRosterChanged }: {
  classId: string; roster: RosterMember[]; candidates: StudentCandidate[]; loading: boolean; selectedStudentId: string; onSelect: (studentId: string) => void; onRosterChanged: () => Promise<void>;
}) {
  const [candidateId, setCandidateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const available = candidates.filter((candidate) => !candidate.enrolled);

  const enroll = async () => {
    if (!candidateId) return;
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/teaching/classes/${classId}/roster`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId: candidateId }) });
    const json = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setMessage(json?.error ?? "Không thể ghi danh học viên."); return; }
    setCandidateId(""); setMessage("Đã thêm học viên vào lớp bằng đúng tài khoản Academy."); await onRosterChanged();
  };

  const openDetail = async (studentId: string) => {
    setLoadingDetail(true);
    const response = await fetch(`/api/teaching/classes/${classId}/students/${studentId}`); const json = await response.json().catch(() => null);
    setDetail(response.ok ? json.student as StudentDetail : null); setLoadingDetail(false);
  };
  const changeStatus = async (status: "paused" | "completed" | "removed") => {
    if (!detail) return;
    const response = await fetch(`/api/teaching/classes/${classId}/roster`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId: detail.studentId, status }) });
    const json = await response.json().catch(() => null);
    if (!response.ok) { setMessage(json?.error ?? "Không thể cập nhật trạng thái."); return; }
    setDetail(null); setMessage(status === "completed" ? "Đã đánh dấu học viên hoàn thành lớp." : status === "paused" ? "Đã tạm dừng học viên." : "Đã đưa học viên ra khỏi lớp."); await onRosterChanged();
  };

  const strengths = (detail?.competency ?? []).filter((skill) => (skill.latestScore ?? 0) >= 85).slice(0, 3);
  const weaknesses = (detail?.competency ?? []).filter((skill) => skill.latestScore != null && skill.latestScore < 60).slice(0, 3);

  return <div style={{ display: "grid", gap: 14 }}><div className={styles.card}>
    <div className={styles.cardHead}><div><h2>Học viên</h2><p>{roster.length} học viên trong lớp · {candidates.length} tài khoản Academy</p></div></div>
    <div className={styles.cardBody}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) auto", gap: 10, marginBottom: 16 }}><select value={candidateId} onChange={(event) => setCandidateId(event.target.value)} style={{ minHeight: 40, border: "1px solid #dfe3e8", borderRadius: 10, padding: "0 10px" }}><option value="">— Chọn tài khoản học viên Academy —</option>{available.map((candidate) => <option key={candidate.studentId} value={candidate.studentId}>{candidate.name} · {candidate.email}{candidate.entitlementCount ? ` · ${candidate.entitlementCount} quyền học` : " · chưa cấp lộ trình"}</option>)}</select><button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={!candidateId || saving} onClick={() => void enroll()}>{saving ? "Đang thêm…" : "+ Thêm vào lớp"}</button></div>
      <p style={{ fontSize: 11, color: "#667085", marginTop: -8 }}>Hệ thống dùng nguyên tài khoản Academy hiện có nên tiến độ lộ trình, nhiệm vụ và hồ sơ luôn cùng một học viên. Ghi danh lớp không tự cấp quyền học; Owner/Admin cấp giai đoạn tại <a href="/academy-admin/distribution">Phân phối lộ trình</a>.</p>
      {!available.length && candidates.length > 0 && <p style={{ fontSize: 12, color: "#667085" }}>Tất cả tài khoản học viên Academy đã có trong lớp này.</p>}
      {!candidates.length && <p style={{ fontSize: 12, color: "#667085" }}>Chưa có tài khoản học viên Academy. Owner/Admin hãy mời tại <a href="/students">Quản lý học viên</a>, sau đó quay lại ghi danh.</p>}
      {message && <p style={{ fontSize: 12, color: message.startsWith("Đã") ? "#177a54" : "#b42318" }}>{message}</p>}
      {loading ? <p>Đang tải…</p> : !roster.length ? <div className={styles.empty}><Users /><strong>Chưa có học viên</strong><p>Chọn một tài khoản Academy ở phía trên để ghi danh vào lớp.</p></div> : <div className={styles.list}>{roster.map((member) => <div key={member.studentId} role="button" tabIndex={0} onClick={() => void openDetail(member.studentId)} onKeyDown={(event) => event.key === "Enter" && void openDetail(member.studentId)} className={styles.listItem} style={{ width: "100%", textAlign: "left", cursor: "pointer", border: member.studentId === (detail?.studentId || selectedStudentId) ? "1px solid #8bdfea" : undefined }}><span className={styles.listItemIcon}><Users size={16} /></span><div><strong>{member.name}</strong><small>{member.joinedAt ? `Nhập học ${new Date(member.joinedAt).toLocaleDateString("vi-VN")}` : "Chưa rõ ngày nhập học"}</small></div><div className={styles.listItemMeta}><span className={styles.badge} data-tone={member.status === "active" ? "success" : undefined}>{member.status}</span><button className={`${styles.button} ${styles.buttonPrimary}`} onClick={(event) => { event.stopPropagation(); onSelect(member.studentId); }}><ClipboardCheck size={13} />Chấm điểm</button></div></div>)}</div>}
    </div>
  </div>
  {loadingDetail && <p>Đang tải hồ sơ học viên…</p>}
  {detail && !loadingDetail && <div className={styles.card}><div className={styles.cardHead}><div><h2>{detail.name}</h2><p>{detail.email}{detail.phone ? ` · ${detail.phone}` : ""}</p></div><span className={styles.badge} data-tone={detail.graduation?.graduationStatus === "graduated" ? "success" : "warning"}>{detail.graduation?.graduationStatus === "graduated" ? "Đủ điều kiện tốt nghiệp" : "Đang hoàn thiện"}</span></div><div className={styles.cardBody}>
    <div className={styles.metrics} style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}><div className={styles.metric}><div><strong>{detail.completedSessions}/{detail.totalSessions || 60}</strong><span>Buổi hoàn thành</span></div></div><div className={styles.metric}><div><strong>{detail.avgScore}</strong><span>Điểm trung bình</span></div></div><div className={styles.metric}><div><strong>{detail.evaluationCount}</strong><span>Lần đánh giá</span></div></div><div className={styles.metric}><div><strong>{Math.round((detail.graduation?.passingEvaluationRatio ?? 0) * 100)}%</strong><span>Tỷ lệ ≥90</span></div></div></div>
    <p style={{ fontSize: 12 }}><b>Điểm mạnh:</b> {strengths.length ? strengths.map((skill) => skill.label).join(", ") : "Chưa đủ dữ liệu"} · <b>Cần cải thiện:</b> {weaknesses.length ? weaknesses.map((skill) => skill.label).join(", ") : "Chưa phát hiện"}</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className={styles.button} onClick={() => void changeStatus("paused")}>Tạm dừng</button><button className={styles.button} onClick={() => void changeStatus("completed")}>Đánh dấu hoàn thành</button><button className={styles.button} onClick={() => void changeStatus("removed")}>Đưa khỏi lớp</button></div>
    <h3 style={{ fontSize: 14, marginTop: 18 }}>Lịch sử buổi học</h3>{!detail.sessionHistory.length ? <p style={{ fontSize: 12, color: "#667085" }}>Lớp chưa có khung buổi học.</p> : <div className={styles.list}>{detail.sessionHistory.slice().reverse().slice(0, 12).map((session) => <div key={session.id} className={styles.listItem}><div><strong>Buổi {session.sessionNo}{session.title ? ` · ${session.title}` : ""}</strong><small>{session.sessionDate ? new Date(session.sessionDate).toLocaleDateString("vi-VN") : "Chưa xếp ngày"} · {session.status === "completed" ? "Đã hoàn thành" : session.status === "cancelled" ? "Đã hủy" : "Đã lên lịch"}</small></div><div className={styles.listItemMeta}><span className={styles.badge} data-tone={session.evaluated ? "success" : undefined}>{session.evaluated ? `${session.score}%` : "Chưa chấm"}</span></div></div>)}</div>}
    <h3 style={{ fontSize: 14, marginTop: 18 }}>Lịch sử điểm, ghi chú và minh chứng</h3>{!detail.evaluations.length ? <p style={{ fontSize: 12, color: "#667085" }}>Chưa có lần đánh giá nào.</p> : <div className={styles.list}>{detail.evaluations.map((evaluation) => <div key={evaluation.id} className={styles.listItem}><div><strong>Buổi {evaluation.sessionNo}{evaluation.sessionTitle ? ` · ${evaluation.sessionTitle}` : ""}</strong><small>{evaluation.notes || "Chưa có ghi chú"} · {evaluation.evidenceCount} minh chứng</small></div><div className={styles.listItemMeta}><b>{evaluation.totalScore}/{evaluation.maxScore}</b><small>{new Date(evaluation.updatedAt).toLocaleDateString("vi-VN")}</small></div></div>)}</div>}
  </div></div>}
  </div>;
}
