"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, History, MessageSquareText, Sparkles, UploadCloud } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useStudentData } from "@/components/student/student-data";
import { canSubmit } from "@/lib/student/assignment-rules";
import type { StudentAssignment, SubmissionAttempt, SubmissionStatus } from "@/lib/student/assignment-rules";
import { JourneyActionsSection } from "@/components/student/journey-actions-section";

// The student side of the assignment transaction. What was here before was seed data behind inert
// buttons: the headline counts were literals, card status came from array position, and nothing
// could actually be submitted. This talks to /api/student/assignments — assignment_definitions and
// brain_assignment_submissions, the same rows the instructor grades in Teaching Intelligence.

const STATUS_LABEL: Record<SubmissionStatus | "not_started", string> = {
  not_started: "Chưa nộp",
  draft: "Bản nháp",
  submitted: "Đã nộp — chờ duyệt",
  in_review: "Giảng viên đang chấm",
  revision_requested: "Cần chỉnh sửa và nộp lại",
  graded: "Đã chấm"
};
const STATUS_TONE: Record<SubmissionStatus | "not_started", string> = {
  not_started: "#8d6073", draft: "#8d6073", submitted: "#176d9b",
  in_review: "#a05a13", revision_requested: "#b22949", graded: "#177a54"
};

function latestOf(assignment: StudentAssignment): SubmissionAttempt | undefined {
  return assignment.attempts[0];
}

export default function StudentAssignmentsPage() {
  const store = useAppStore();
  const { summary } = useStudentData();
  const live = summary?.mode === "production";

  const [assignments, setAssignments] = useState<StudentAssignment[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/student/assignments", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { assignments?: StudentAssignment[] } | null;
    setAssignments(payload?.assignments ?? []);
  }, []);

  useEffect(() => { if (live) void load(); }, [live, load]);

  async function submit(assignmentId: string) {
    setBusy(true); setError("");
    const response = await fetch("/api/student/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignmentId, textResponse: draft })
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(payload?.error === "EMPTY_SUBMISSION" ? "Hãy mô tả bài làm của bạn trước khi nộp." : "Không nộp được bài. Vui lòng thử lại.");
      return;
    }
    setDraft(""); setOpenId(null);
    await load();
  }

  const head = <section className="h2o-student-page-head">
    <div><span>PRACTICE &amp; FEEDBACK</span><h1>Bài tập thực hành</h1>
      <p>Nộp bài, nhận nhận xét theo từng tiêu chí và chỉnh sửa cho tới khi đạt.</p></div>
  </section>;

  if (!live) {
    return <>{head}
      <div className="h2o-library-highlight"><Sparkles /><div><span>CHẾ ĐỘ DEMO</span><h2>Đây là bài tập mẫu.</h2><p>Nội dung bên dưới là dữ liệu minh họa, không phải bài của bạn.</p></div></div>
      <div className="h2o-assignment-board">{store.assignments.map((assignment) => <article key={assignment.id}>
        <header><span>DỮ LIỆU MẪU</span><small><Clock3 />Minh họa</small></header>
        <h2>{assignment.title}</h2><p>{assignment.instructions}</p>
      </article>)}</div>
    </>;
  }

  if (assignments === null) return <>{head}<JourneyActionsSection /><p style={{ color: "#718092", fontSize: 13 }}>Đang tải bài tập…</p></>;

  if (assignments.length === 0) {
    return <>{head}
      <JourneyActionsSection />
      <section className="h2o-student-card"><div style={{ padding: 20, display: "grid", gap: 10 }}>
        <strong style={{ fontSize: 15 }}>Chưa có bài tập nào được giao cho bạn.</strong>
        <p style={{ margin: 0, color: "#718092", fontSize: 13, lineHeight: 1.7 }}>Khi giảng viên giao bài, bài tập sẽ xuất hiện ở đây kèm yêu cầu và tiêu chí chấm.</p>
        <div><Link href="/student/courses" className="h2o-student-primary">Tiếp tục học <ArrowRight /></Link></div>
      </div></section>
    </>;
  }

  const counts = {
    todo: assignments.filter((assignment) => canSubmit(assignment)).length,
    waiting: assignments.filter((assignment) => ["submitted", "in_review"].includes(latestOf(assignment)?.status ?? "")).length,
    graded: assignments.filter((assignment) => latestOf(assignment)?.status === "graded").length
  };

  return <>{head}
    <JourneyActionsSection />
    <section className="h2o-student-assignment-metrics">
      <article><strong>{counts.todo}</strong><span>Cần nộp</span></article>
      <article><strong>{counts.waiting}</strong><span>Chờ giảng viên</span></article>
      <article><strong>{counts.graded}</strong><span>Đã chấm</span></article>
      <article><strong>{assignments.length}</strong><span>Tổng số bài</span></article>
    </section>

    <div className="h2o-assignment-board">{assignments.map((assignment) => {
      const latest = latestOf(assignment);
      const status: SubmissionStatus | "not_started" = latest?.status ?? "not_started";
      const open = openId === assignment.id;
      return <article key={assignment.id}>
        <header>
          <span style={{ color: STATUS_TONE[status] }}>{STATUS_LABEL[status]}</span>
          {latest?.submittedAt && <small><Clock3 />Nộp {new Date(latest.submittedAt).toLocaleDateString("vi-VN")}</small>}
        </header>
        <h2>{assignment.title}</h2>
        <p>{assignment.instructions || "Giảng viên chưa bổ sung mô tả cho bài này."}</p>

        {assignment.criteria.length > 0 && <div className="h2o-assignment-rubric">
          {assignment.criteria.map((criterion) => {
            const scored = latest?.criterionScores.find((entry) => entry.criterionId === criterion.id);
            return <span key={criterion.id} title={criterion.description}>
              <CheckCircle2 />{criterion.title}{scored ? ` · ${scored.score}/${scored.maxScore}` : ""}
            </span>;
          })}
        </div>}

        {latest?.status === "graded" && <p style={{ color: "#177a54", fontWeight: 700, fontSize: 13 }}>
          Điểm: {latest.score ?? "—"}/{assignment.maxScore}{latest.portfolioReady ? " · đã đưa vào portfolio" : ""}
        </p>}

        {latest?.instructorFeedback && <blockquote style={{ margin: "10px 0", padding: "10px 14px", borderLeft: "3px solid #dfe3e8", color: "#5d6a78", fontSize: 13, lineHeight: 1.7 }}>
          <MessageSquareText size={13} aria-hidden="true" /> {latest.instructorFeedback}
        </blockquote>}

        {assignment.attempts.length > 1 && <details style={{ margin: "8px 0", fontSize: 12, color: "#718092" }}>
          <summary style={{ cursor: "pointer" }}>Lịch sử {assignment.attempts.length} lần nộp</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
            {assignment.attempts.map((attempt) => <li key={attempt.id}>
              {new Date(attempt.createdAt).toLocaleDateString("vi-VN")} — {STATUS_LABEL[attempt.status]}{attempt.score !== null ? ` · ${attempt.score} điểm` : ""}
            </li>)}
          </ul>
        </details>}

        <footer>
          {canSubmit(assignment)
            ? <button onClick={() => { setOpenId(open ? null : assignment.id); setDraft(latest?.status === "draft" ? latest.textResponse : ""); setError(""); }}>
                <UploadCloud />{latest?.status === "revision_requested" ? "Nộp lại" : "Nộp bài"}
              </button>
            : <span style={{ fontSize: 12, color: "#718092" }}><History size={12} aria-hidden="true" /> {status === "graded" ? "Đã hoàn tất" : "Đang chờ giảng viên chấm"}</span>}
        </footer>

        {open && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <label htmlFor={`response-${assignment.id}`} style={{ fontSize: 12, fontWeight: 700 }}>Mô tả bài làm của bạn</label>
          <textarea id={`response-${assignment.id}`} name="textResponse" value={draft} onChange={(event) => setDraft(event.target.value)} rows={4}
            placeholder="Bạn đã làm gì, dùng kỹ thuật nào, gặp khó ở đâu…"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", font: "inherit", fontSize: 13 }} />
          {error && <p style={{ margin: 0, color: "#b22949", fontSize: 12 }}>{error}</p>}
          <p style={{ margin: 0, color: "#718092", fontSize: 11 }}>Tải ảnh bài làm sẽ được bổ sung ở bản kế tiếp; hiện tại hãy mô tả bằng chữ.</p>
          <div><button className="h2o-student-primary" disabled={busy} onClick={() => submit(assignment.id)}>{busy ? "Đang nộp…" : "Gửi cho giảng viên"}</button></div>
        </div>}
      </article>;
    })}</div>
  </>;
}
