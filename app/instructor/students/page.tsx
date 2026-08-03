"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, UsersRound } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { instructorRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type StudentSummary = {
  studentId: string; name: string; progressPercent: number; masteryPercent: number; overdueAssignments: number;
  risk: { score: number; severity: "healthy" | "watch" | "attention" | "critical"; flags: string[]; recommendedActions: string[] };
};
type Intervention = { id: string; actionType: string; note: string | null; status: string; riskLevel: string; createdAt: string };

const SEVERITY_TONE: Record<StudentSummary["risk"]["severity"], "danger" | "warning" | "purple" | undefined> = { critical: "danger", attention: "warning", watch: "purple", healthy: undefined };

export default function InstructorStudentsPage() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState("message");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/teaching/students");
      const json = await res.json();
      if (res.ok) {
        setStudents(json.students ?? []);
        const params = new URLSearchParams(window.location.search);
        setSelectedId(params.get("focus") || json.students?.[0]?.studentId || null);
      }
      setLoading(false);
    })();
  }, []);

  async function loadDetail(studentId: string) {
    setSelectedId(studentId);
    const res = await fetch(`/api/teaching/students/${studentId}`);
    const json = await res.json();
    if (res.ok) setInterventions(json.interventions ?? []);
  }

  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  const selected = students.find((s) => s.studentId === selectedId);

  async function createIntervention() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch("/api/teaching/interventions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selected.studentId, riskLevel: selected.risk.severity === "healthy" ? "watch" : selected.risk.severity, reasonCodes: selected.risk.flags, actionType, note })
    });
    setSaving(false);
    if (res.ok) { setNote(""); await loadDetail(selected.studentId); }
  }

  async function markDone(interventionId: string) {
    await fetch(`/api/teaching/interventions/${interventionId}/complete`, { method: "POST" });
    if (selected) await loadDetail(selected.studentId);
  }

  return <SimpleOperationsShell title="H2OBOOK Instructor" subtitle="Student Success Center" homeHref="/instructor" routes={instructorRoutes} accentLabel="Instructor Workspace">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>STUDENT SUCCESS CENTER</span><h1>Học viên phụ trách &amp; Risk Radar</h1><p>Danh sách chỉ gồm học viên trong lớp bạn phụ trách — xếp theo mức độ rủi ro thực tế (không hoạt động, tiến độ thấp, quá hạn, chờ phản hồi, năng lực thấp).</p></div>
    </header>

    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.span5}`}>
        <div className={styles.cardHead}><div><h2>Học viên được giao</h2><p>{students.length} học viên</p></div></div>
        <div className={styles.cardBody}>
          {loading ? <p>Đang tải…</p> : !students.length ? (
            <div className={styles.empty}><UsersRound /><strong>Chưa có học viên nào</strong><p>Bạn chưa được gán làm giáo viên của lớp nào.</p></div>
          ) : (
            <div className={styles.list}>
              {students.map((student) => (
                <button key={student.studentId} onClick={() => setSelectedId(student.studentId)} className={styles.listItem} style={{ width: "100%", textAlign: "left", border: student.studentId === selectedId ? "1px solid #8bdfea" : undefined, cursor: "pointer" }}>
                  <span className={styles.listItemIcon}>{student.risk.severity === "critical" || student.risk.severity === "attention" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}</span>
                  <div><strong>{student.name}</strong><small>Tiến độ {student.progressPercent}% · Năng lực {student.masteryPercent}%</small></div>
                  <div className={styles.listItemMeta}><span className={styles.badge} data-tone={SEVERITY_TONE[student.risk.severity]}>{student.risk.severity}</span></div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.card} ${styles.span7}`}>
        {!selected ? (
          <div className={styles.cardBody}><div className={styles.empty}><UsersRound /><strong>Chọn một học viên</strong><p>Xem chi tiết rủi ro và ghi chú can thiệp.</p></div></div>
        ) : (
          <>
            <div className={styles.cardHead}><div><h2>{selected.name}</h2><p>Điểm rủi ro {selected.risk.score}/100 · {selected.overdueAssignments} bài quá hạn</p></div></div>
            <div className={styles.cardBody}>
              {selected.risk.recommendedActions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: 11 }}>Hành động đề xuất</strong>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 11, color: "#5c606a", lineHeight: 1.7 }}>
                    {selected.risk.recommendedActions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 14 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Loại can thiệp
                  <select value={actionType} onChange={(e) => setActionType(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
                    {["message", "assignment", "meeting", "resource", "stage_review", "other"].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Ghi chú
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú can thiệp riêng tư" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
                </label>
                <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={saving} onClick={createIntervention}>Ghi nhận</button>
              </div>

              <strong style={{ fontSize: 11 }}>Lịch sử can thiệp</strong>
              <div className={styles.list} style={{ marginTop: 8 }}>
                {interventions.length === 0 ? <p style={{ fontSize: 11, color: "#8b8e97" }}>Chưa có ghi chú nào.</p> : interventions.map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <div><strong>{item.actionType}</strong><small>{item.note ?? "—"}</small></div>
                    <div className={styles.listItemMeta}>
                      <span className={styles.badge} data-tone={item.status === "completed" ? "success" : undefined}>{item.status}</span>
                      {item.status !== "completed" && <button onClick={() => markDone(item.id)} style={{ display: "block", marginTop: 6, fontSize: 9, border: "none", background: "none", color: "#0c6e86", cursor: "pointer" }}>Đánh dấu xong</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  </SimpleOperationsShell>;
}
