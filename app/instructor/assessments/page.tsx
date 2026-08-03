"use client";
import { useEffect, useState } from "react";
import { BookOpenCheck, CheckCircle2, ClipboardCheck } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { instructorRoutes } from "@/lib/operations/routes";
import { studentSkills } from "@/lib/student/experience";
import styles from "@/components/operations/operations.module.css";

type QueueRow = { id: string; source: "legacy" | "brain"; title: string; studentId: string; studentName: string; submittedAt: string | null; maxScore: number };
type PendingProject = { id: string; title: string; studentId: string; studentName: string; readinessScore: number; updatedAt: string };

export default function InstructorAssessmentsPage() {
  const [tab, setTab] = useState<"submissions" | "portfolio">("submissions");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [projects, setProjects] = useState<PendingProject[]>([]);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const [score, setScore] = useState(80);
  const [feedback, setFeedback] = useState("");
  const [skillKey, setSkillKey] = useState("");
  const [reflectionDone, setReflectionDone] = useState(true);
  const [confirmPortfolio, setConfirmPortfolio] = useState(false);
  const [decision, setDecision] = useState<"graded" | "returned">("graded");

  async function load() {
    setLoading(true);
    const [queueRes, projectsRes] = await Promise.all([fetch("/api/teaching/submissions"), fetch("/api/teaching/projects")]);
    const queueJson = await queueRes.json();
    const projectsJson = await projectsRes.json();
    if (queueRes.ok) setQueue(queueJson.submissions ?? []);
    if (projectsRes.ok) setProjects(projectsJson.projects ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function selectRow(row: QueueRow) {
    setSelected(row); setScore(80); setFeedback(""); setSkillKey(""); setReflectionDone(true); setConfirmPortfolio(false); setDecision("graded"); setResult(null);
  }

  async function submitGrade() {
    if (!selected) return;
    setSaving(true); setResult(null);
    const url = selected.source === "brain" ? `/api/teaching/submissions/brain/${selected.id}/grade` : `/api/teaching/submissions/legacy/${selected.id}/grade`;
    const body = selected.source === "brain"
      ? { criteria: [{ criterionId: "overall", score, maxScore: 100, required: true }], writtenFeedback: feedback, skillKey: skillKey || undefined, skillScore: score, learnerReflectionComplete: reflectionDone, confirmPortfolioReady: confirmPortfolio }
      : { score, feedback, decision };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setResult(json.error ?? "Không chấm được bài."); return; }
    setResult(selected.source === "brain" ? `Đã lưu: ${json.decision}` : "Đã lưu điểm.");
    setSelected(null);
    await load();
  }

  async function reviewProject(projectId: string, projectDecision: "approved" | "in_progress") {
    await fetch(`/api/teaching/projects/${projectId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: projectDecision }) });
    await load();
  }

  return <SimpleOperationsShell title="H2OBOOK Instructor" subtitle="Feedback Studio" homeHref="/instructor" routes={instructorRoutes} accentLabel="Instructor Workspace">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>FEEDBACK STUDIO</span><h1>Bài cần chấm &amp; duyệt thành quả</h1><p>Hàng đợi hợp nhất từ bài tập lớp học và bài tập Brain Studio, cộng thêm thành quả Create Outcome đang chờ duyệt.</p></div>
      <div className={styles.headerActions}>
        <button className={`${styles.button} ${tab === "submissions" ? styles.buttonPrimary : styles.buttonSecondary}`} onClick={() => setTab("submissions")}>Bài chờ chấm ({queue.length})</button>
        <button className={`${styles.button} ${tab === "portfolio" ? styles.buttonPrimary : styles.buttonSecondary}`} onClick={() => setTab("portfolio")}>Portfolio chờ duyệt ({projects.length})</button>
      </div>
    </header>

    {tab === "submissions" ? (
      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.span5}`}>
          <div className={styles.cardHead}><div><h2>Hàng đợi</h2><p>Sắp xếp theo thời gian chờ</p></div></div>
          <div className={styles.cardBody}>
            {loading ? <p>Đang tải…</p> : !queue.length ? (
              <div className={styles.empty}><CheckCircle2 /><strong>Không còn bài chờ chấm</strong><p>Tất cả bài nộp đã được xử lý.</p></div>
            ) : (
              <div className={styles.list}>
                {queue.map((row) => (
                  <button key={`${row.source}-${row.id}`} onClick={() => selectRow(row)} className={styles.listItem} style={{ width: "100%", textAlign: "left", cursor: "pointer", border: selected?.id === row.id ? "1px solid #8bdfea" : undefined }}>
                    <span className={styles.listItemIcon}><BookOpenCheck size={16} /></span>
                    <div><strong>{row.studentName}</strong><small>{row.title}</small></div>
                    <div className={styles.listItemMeta}><span className={styles.badge} data-tone="purple">{row.source === "brain" ? "Brain Studio" : "Lớp học"}</span></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={`${styles.card} ${styles.span7}`}>
          {!selected ? (
            <div className={styles.cardBody}><div className={styles.empty}><ClipboardCheck /><strong>Chọn một bài để chấm</strong><p>Chọn một bài từ hàng đợi bên trái.</p></div></div>
          ) : (
            <>
              <div className={styles.cardHead}><div><h2>{selected.studentName}</h2><p>{selected.title}</p></div></div>
              <div className={styles.cardBody}>
                {result && <p style={{ fontSize: 12, color: "#177a54" }}>{result}</p>}
                <label style={{ display: "grid", gap: 6, fontSize: 11, marginBottom: 12 }}>Điểm (0-100)
                  <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", maxWidth: 120 }} />
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 11, marginBottom: 12 }}>Phản hồi bằng văn bản
                  <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder="Nhận xét chi tiết cho học viên…" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
                </label>

                {selected.source === "brain" ? (
                  <>
                    <label style={{ display: "grid", gap: 6, fontSize: 11, marginBottom: 12 }}>Ghi nhận bằng chứng kỹ năng
                      <select value={skillKey} onChange={(e) => setSkillKey(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
                        <option value="">— Không ghi nhận —</option>
                        {studentSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.title}</option>)}
                      </select>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 12 }}>
                      <input type="checkbox" checked={reflectionDone} onChange={(e) => setReflectionDone(e.target.checked)} /> Học viên đã hoàn thành tự đánh giá
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 16 }}>
                      <input type="checkbox" checked={confirmPortfolio} onChange={(e) => setConfirmPortfolio(e.target.checked)} /> Xác nhận đủ điều kiện Portfolio-ready (yêu cầu giảng viên xác nhận rõ ràng)
                    </label>
                  </>
                ) : (
                  <label style={{ display: "grid", gap: 6, fontSize: 11, marginBottom: 16 }}>Quyết định
                    <select value={decision} onChange={(e) => setDecision(e.target.value as "graded" | "returned")} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
                      <option value="graded">Đạt (graded)</option>
                      <option value="returned">Yêu cầu làm lại (returned)</option>
                    </select>
                  </label>
                )}

                <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={saving} onClick={submitGrade}>Lưu chấm bài</button>
              </div>
            </>
          )}
        </section>
      </div>
    ) : (
      <div className={styles.card}>
        <div className={styles.cardHead}><div><h2>Portfolio chờ duyệt</h2><p>{projects.length} dự án Create Outcome</p></div></div>
        <div className={styles.cardBody}>
          {!projects.length ? (
            <div className={styles.empty}><CheckCircle2 /><strong>Không có dự án chờ duyệt</strong><p>Portfolio mới sẽ hiện tại đây khi học viên gửi duyệt.</p></div>
          ) : (
            <div className={styles.list}>
              {projects.map((project) => (
                <div key={project.id} className={styles.listItem}>
                  <span className={styles.listItemIcon}><ClipboardCheck size={16} /></span>
                  <div><strong>{project.title}</strong><small>{project.studentName} · Sẵn sàng {project.readinessScore}%</small></div>
                  <div className={styles.listItemMeta} style={{ display: "flex", gap: 6 }}>
                    <button className={`${styles.button} ${styles.buttonPrimary}`} style={{ minHeight: 32, padding: "0 10px", fontSize: 10 }} onClick={() => reviewProject(project.id, "approved")}>Duyệt</button>
                    <button className={`${styles.button} ${styles.buttonSecondary}`} style={{ minHeight: 32, padding: "0 10px", fontSize: 10 }} onClick={() => reviewProject(project.id, "in_progress")}>Yêu cầu sửa</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </SimpleOperationsShell>;
}
