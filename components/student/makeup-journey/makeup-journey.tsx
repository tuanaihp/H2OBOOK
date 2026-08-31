"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardList, GraduationCap, ImagePlus, Scissors, Sparkles, X } from "lucide-react";
import { uploadAsset, resolveAssetUrl } from "@/lib/assets/asset-client";
import { SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import styles from "./makeup-journey.module.css";

// ---------------------------------------------------------------------------
// Shapes mirror lib/student-competency/service.ts::getOwnClassJourney (ClassJourney).
// ---------------------------------------------------------------------------
type SessionStatus = "scheduled" | "completed" | "cancelled";
interface ClassSession { id: string; sessionNo: number; sessionType: SessionType; title: string; sessionDate: string | null; status: SessionStatus }
interface RubricCriterion { id: string; title: string; description: string; maxScore: number; required: boolean }
interface Rubric { id: string; title: string; category: "training" | "makeup" | "hair" | null; criteria: RubricCriterion[] }
interface Evaluation { classSessionId: string; totalScore: number; maxScore: number; criterionScores: Record<string, number>; notes: string; assetIds: string[]; updatedAt: string }
interface Submission { classSessionId: string; assetIds: string[]; note: string; updatedAt: string }
interface Journey {
  class: { id: string; name: string; code: string; status: string; totalSessions: number };
  sessions: ClassSession[];
  evaluations: Evaluation[];
  submissions: Submission[];
  rubrics: Rubric[];
}

const MAX_EVIDENCE = 6;

type TabKey = "schedule" | "training" | "practice" | "hair";
const TABS: { key: TabKey; label: string; icon: typeof CalendarDays; types: SessionType[] }[] = [
  { key: "schedule", label: "Lịch học", icon: CalendarDays, types: [] },
  { key: "training", label: "Học training", icon: ClipboardList, types: ["training_makeup_hair"] },
  { key: "practice", label: "Học thực hành", icon: Sparkles, types: ["practice_makeup_hair"] },
  { key: "hair", label: "Bới tóc", icon: Scissors, types: ["training_hair", "practice_hair"] }
];

const CATEGORY_FOR_TYPE: Partial<Record<SessionType, "training" | "makeup" | "hair">> = {
  training_makeup_hair: "training",
  training_hair: "training",
  practice_makeup_hair: "makeup",
  practice_hair: "hair"
};

const SESSION_STATUS_LABEL: Record<SessionStatus, string> = { scheduled: "Chưa diễn ra", completed: "Đã học", cancelled: "Đã huỷ" };

function pct(score: number, max: number) {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

export function MakeupJourney() {
  const [journey, setJourney] = useState<Journey | null | undefined>(undefined);
  const [mode, setMode] = useState<"demo" | "production" | null>(null);
  const [tab, setTab] = useState<TabKey>("schedule");

  const load = useCallback(async () => {
    const response = await fetch("/api/student/makeup-journey", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { mode?: "demo" | "production"; journey?: Journey | null } | null;
    setMode(payload?.mode ?? null);
    setJourney(payload?.journey ?? null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onSubmissionSaved = useCallback((next: Submission) => {
    setJourney((current) => {
      if (!current) return current;
      const rest = current.submissions.filter((s) => s.classSessionId !== next.classSessionId);
      return { ...current, submissions: [...rest, next] };
    });
  }, []);

  const evaluationBySession = useMemo(() => new Map((journey?.evaluations ?? []).map((e) => [e.classSessionId, e])), [journey]);
  const submissionBySession = useMemo(() => new Map((journey?.submissions ?? []).map((s) => [s.classSessionId, s])), [journey]);
  const rubricByCategory = useMemo(() => new Map((journey?.rubrics ?? []).map((r) => [r.category, r])), [journey]);

  const head = (
    <section className="h2o-student-page-head">
      <div>
        <span>MAKEUP PROFESSIONAL · 60 BUỔI</span>
        <h1>Khóa Makeup 60 buổi</h1>
        <p>Theo dõi lịch học, nộp minh chứng cho từng buổi và xem điểm giảng viên chấm theo tiêu chí.</p>
      </div>
    </section>
  );

  if (journey === undefined) return <>{head}<p className={styles.muted}>Đang tải hành trình khóa học…</p></>;

  if (mode === "demo") {
    return <>{head}
      <div className={styles.notice}><Sparkles size={16} /><div><strong>Chế độ demo</strong><p>Đăng nhập bằng tài khoản học viên thật để xem khóa Makeup của bạn.</p></div></div>
    </>;
  }

  if (!journey) {
    return <>{head}
      <section className={styles.emptyCard}>
        <GraduationCap size={34} />
        <h2>Bạn chưa được ghi danh vào lớp Makeup nào</h2>
        <p>Khi giảng viên hoặc Academy thêm bạn vào một lớp Makeup Chuyên nghiệp, toàn bộ 60 buổi sẽ hiện ở đây kèm chỗ nộp minh chứng cho từng buổi.</p>
        <Link href="/student/courses" className="h2o-student-primary">Về trang khóa học</Link>
      </section>
    </>;
  }

  const { sessions, evaluations, class: klass } = journey;
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const gradedPercents = evaluations.filter((e) => e.maxScore > 0).map((e) => pct(e.totalScore, e.maxScore));
  const avgScore = gradedPercents.length ? Math.round(gradedPercents.reduce((a, b) => a + b, 0) / gradedPercents.length) : null;
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const tabSessions = tab === "schedule" ? sessions : sessions.filter((s) => activeTab.types.includes(s.sessionType));

  return <>{head}

    <section className={styles.classBar}>
      <div>
        <strong>{klass.name}</strong>
        <span>Mã lớp {klass.code} · {klass.totalSessions} buổi</span>
      </div>
      <div className={styles.classMetrics}>
        <span><b>{completedCount}</b>/{klass.totalSessions} buổi đã học</span>
        <span><b>{evaluations.length}</b> buổi đã chấm</span>
        <span><b>{avgScore === null ? "—" : `${avgScore}%`}</b> điểm trung bình</span>
      </div>
    </section>

    <nav className={styles.tabs}>
      {TABS.map((t) => {
        const Icon = t.icon;
        return <button key={t.key} type="button" data-active={t.key === tab} onClick={() => setTab(t.key)}>
          <Icon size={15} />{t.label}
        </button>;
      })}
    </nav>

    {tab === "schedule"
      ? <ScheduleTable sessions={sessions} evaluationBySession={evaluationBySession} submissionBySession={submissionBySession} />
      : tabSessions.length === 0
        ? <p className={styles.muted}>Lớp chưa có buổi nào thuộc nhóm này. Giảng viên sẽ thêm vào lịch.</p>
        : <div className={styles.sessionList}>
            {tabSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                rubric={rubricByCategory.get(CATEGORY_FOR_TYPE[session.sessionType] ?? null) ?? null}
                evaluation={evaluationBySession.get(session.id) ?? null}
                submission={submissionBySession.get(session.id) ?? null}
                onSaved={onSubmissionSaved}
              />
            ))}
          </div>}
  </>;
}

function ScheduleTable({ sessions, evaluationBySession, submissionBySession }: {
  sessions: ClassSession[];
  evaluationBySession: Map<string, Evaluation>;
  submissionBySession: Map<string, Submission>;
}) {
  return <div className={styles.scheduleWrap}>
    <table className={styles.schedule}>
      <thead><tr><th>Buổi</th><th>Nội dung</th><th>Ngày</th><th>Trạng thái</th><th>Minh chứng / Điểm</th></tr></thead>
      <tbody>
        {sessions.map((session) => {
          const evaluation = evaluationBySession.get(session.id);
          const submission = submissionBySession.get(session.id);
          return <tr key={session.id}>
            <td>{session.sessionNo}</td>
            <td>
              <strong>{SESSION_TYPE_LABEL[session.sessionType]}</strong>
              {session.title && <small>{session.title}</small>}
            </td>
            <td>{session.sessionDate ? new Date(session.sessionDate).toLocaleDateString("vi-VN") : "—"}</td>
            <td><span className={styles.pill} data-tone={session.status === "completed" ? "done" : session.status === "cancelled" ? "off" : undefined}>{SESSION_STATUS_LABEL[session.status]}</span></td>
            <td>
              {evaluation
                ? <span className={styles.pill} data-tone={pct(evaluation.totalScore, evaluation.maxScore) >= 90 ? "done" : "warn"}>Đã chấm · {evaluation.totalScore}/{evaluation.maxScore}</span>
                : (submission?.assetIds.length ?? 0) > 0
                  ? <span className={styles.pill} data-tone="info">Đã nộp {submission!.assetIds.length} ảnh</span>
                  : <span className={styles.pill}>Chưa nộp</span>}
            </td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

function SessionCard({ session, rubric, evaluation, submission, onSaved }: {
  session: ClassSession;
  rubric: Rubric | null;
  evaluation: Evaluation | null;
  submission: Submission | null;
  onSaved: (next: Submission) => void;
}) {
  return <article className={styles.card}>
    <header className={styles.cardHead}>
      <div>
        <strong>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</strong>
        {session.title && <p>{session.title}</p>}
      </div>
      <span className={styles.pill} data-tone={session.status === "completed" ? "done" : undefined}>
        {SESSION_STATUS_LABEL[session.status]}
        {session.sessionDate ? ` · ${new Date(session.sessionDate).toLocaleDateString("vi-VN")}` : ""}
      </span>
    </header>

    <SessionEvidence sessionId={session.id} submission={submission} locked={Boolean(evaluation)} onSaved={onSaved} />

    {evaluation
      ? <GradePanel evaluation={evaluation} rubric={rubric} />
      : <div className={styles.pendingPanel}>
          <span className={styles.pendingTag}>Chưa chấm</span>
          {rubric && rubric.criteria.length > 0
            ? <>
                <p>Giảng viên sẽ chấm dựa trên minh chứng bạn nộp và các tiêu chí sau:</p>
                <ul className={styles.criteriaList}>
                  {rubric.criteria.map((c) => (
                    <li key={c.id}><span>{c.title}</span><b>/ {c.maxScore}{c.required ? " · bắt buộc" : ""}</b></li>
                  ))}
                </ul>
              </>
            : <p>Buổi này chưa gắn bộ tiêu chí chấm.</p>}
        </div>}
  </article>;
}

function SessionEvidence({ sessionId, submission, locked, onSaved }: {
  sessionId: string;
  submission: Submission | null;
  locked: boolean;
  onSaved: (next: Submission) => void;
}) {
  const [assetIds, setAssetIds] = useState<string[]>(submission?.assetIds ?? []);
  const [note, setNote] = useState(submission?.note ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAssetIds(submission?.assetIds ?? []);
    setNote(submission?.note ?? "");
  }, [submission]);

  const dirty = note !== (submission?.note ?? "") ||
    assetIds.length !== (submission?.assetIds.length ?? 0) ||
    assetIds.some((id, i) => id !== submission?.assetIds[i]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const room = MAX_EVIDENCE - assetIds.length;
    if (room <= 0) { setMessage(`Tối đa ${MAX_EVIDENCE} ảnh.`); return; }
    setUploading(true); setMessage(null);
    try {
      for (const file of files.slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const asset = await uploadAsset(file, { category: "student-competency", assetType: "image", compress: true });
        setAssetIds((current) => [...current, asset.assetId]);
      }
    } catch {
      setMessage("Tải ảnh thất bại — thử lại.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/student/makeup-journey/submission", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classSessionId: sessionId, assetIds, note })
      });
      const payload = await response.json().catch(() => null) as { error?: string; submission?: Submission } | null;
      if (!response.ok || !payload?.submission) {
        setMessage(payload?.error === "STUDENT_NOT_IN_CLASS" ? "Bạn không còn trong lớp này." : "Không lưu được minh chứng.");
        return;
      }
      onSaved(payload.submission);
      setMessage("Đã lưu minh chứng.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.evidence}>
    <div className={styles.evidenceHead}>
      <span>Minh chứng của bạn {locked && <em>· đã khoá vì buổi đã được chấm</em>}</span>
    </div>
    <div className={styles.thumbRow}>
      {assetIds.map((id) => (
        <span key={id} className={styles.thumb}>
          <AssetThumb assetId={id} />
          {!locked && <button type="button" aria-label="Bỏ ảnh này" onClick={() => setAssetIds((v) => v.filter((x) => x !== id))}><X size={12} /></button>}
        </span>
      ))}
      {!locked && assetIds.length < MAX_EVIDENCE && (
        <label className={styles.addThumb}>
          <ImagePlus size={16} />{uploading ? "Đang tải…" : "Thêm ảnh"}
          <input type="file" accept="image/*" multiple disabled={uploading} onChange={onPick} hidden />
        </label>
      )}
      {assetIds.length === 0 && locked && <span className={styles.muted}>Không có ảnh nào được nộp cho buổi này.</span>}
    </div>
    {!locked && <textarea
      className={styles.note}
      value={note}
      onChange={(e) => setNote(e.target.value)}
      rows={2}
      maxLength={500}
      placeholder="Ghi chú ngắn: makeup gì, cho ai, dùng kỹ thuật nào…"
    />}
    {locked && note && <p className={styles.lockedNote}>{note}</p>}
    {!locked && <div className={styles.evidenceActions}>
      <button type="button" className="h2o-student-primary" disabled={saving || uploading || !dirty} onClick={save}>
        {saving ? "Đang lưu…" : "Lưu minh chứng"}
      </button>
      {message && <span className={styles.message}>{message}</span>}
    </div>}
    {locked && message && <span className={styles.message}>{message}</span>}
  </div>;
}

function GradePanel({ evaluation, rubric }: { evaluation: Evaluation; rubric: Rubric | null }) {
  const percent = pct(evaluation.totalScore, evaluation.maxScore);
  return <div className={styles.gradePanel}>
    <div className={styles.gradeTop}>
      <div>
        <span>Điểm giảng viên</span>
        <strong>{evaluation.totalScore}<i>/{evaluation.maxScore}</i></strong>
      </div>
      <span className={styles.pill} data-tone={percent >= 90 ? "done" : percent >= 70 ? "info" : "warn"}>{percent}%</span>
    </div>

    {rubric && rubric.criteria.length > 0 && (
      <ul className={styles.criteriaList}>
        {rubric.criteria.map((c) => {
          const s = evaluation.criterionScores[c.id] ?? 0;
          return <li key={c.id}>
            <span>{c.title}</span>
            <b data-low={s < c.maxScore * 0.6 ? "" : undefined}>{s} / {c.maxScore}</b>
          </li>;
        })}
      </ul>
    )}

    {evaluation.notes && <p className={styles.gradeNotes}>{evaluation.notes}</p>}

    {evaluation.assetIds.length > 0 && <div className={styles.thumbRow}>
      {evaluation.assetIds.map((id) => <span key={id} className={styles.thumb}><AssetThumb assetId={id} /></span>)}
    </div>}
  </div>;
}

function AssetThumb({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolveAssetUrl(assetId).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [assetId]);
  if (!url) return <span className={styles.thumbPlaceholder}><CheckCircle2 size={14} /></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Minh chứng" /></a>;
}
