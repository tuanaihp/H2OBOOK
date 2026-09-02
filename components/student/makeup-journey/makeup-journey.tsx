"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2, ClipboardList, GraduationCap, Home, ImagePlus, Scissors, Sparkles, X } from "lucide-react";
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
interface AiCriterion { score: number; maxScore: number; strength: string; issue: string; recommendation: string }
interface AiAssessment {
  id: string;
  classSessionId: string;
  provider: string;
  status: "ai_draft" | "unavailable";
  totalScore: number | null;
  maxScore: number;
  summary: string;
  priorityFixes: string[];
  criterionScores: Record<string, AiCriterion>;
  rubricSnapshot: { id: string; label: string; maxScore: number; description?: string }[];
  createdAt: string;
}
interface Journey {
  class: { id: string; organizationId: string; name: string; code: string; status: string; totalSessions: number; startedAt: string | null };
  sessions: ClassSession[];
  evaluations: Evaluation[];
  submissions: Submission[];
  aiAssessments: AiAssessment[];
  rubrics: Rubric[];
}

const MAX_EVIDENCE = 6;

export type JourneyView = "schedule" | "training" | "practice" | "hair";

const VIEW_META: Record<JourneyView, { title: string; sub: string; types: SessionType[] | null }> = {
  schedule: { title: "Lộ trình", sub: "Toàn bộ các buổi của chương trình.", types: null },
  training: { title: "Học training", sub: "Các buổi Training Makeup & Tóc.", types: ["training_makeup_hair"] },
  practice: { title: "Học thực hành", sub: "Các buổi thực hành Makeup & Tóc trên mẫu.", types: ["practice_makeup_hair"] },
  hair: { title: "Bới tóc", sub: "Các buổi Training Tóc và thực hành Tóc.", types: ["training_hair", "practice_hair"] },
};

const CATEGORY_FOR_TYPE: Record<SessionType, "training" | "makeup" | "hair" | "extra"> = {
  training_makeup_hair: "training",
  training_hair: "training",
  practice_makeup_hair: "makeup",
  practice_hair: "hair",
  extracurricular: "extra",
};
const RUBRIC_FOR_TYPE: Partial<Record<SessionType, "training" | "makeup" | "hair">> = {
  training_makeup_hair: "training", training_hair: "training",
  practice_makeup_hair: "makeup", practice_hair: "hair",
};
const SESSION_STATUS_LABEL: Record<SessionStatus, string> = { scheduled: "Chưa diễn ra", completed: "Đã học", cancelled: "Đã huỷ" };

// Roadmap phases = the curriculum's session-type blocks, in order.
const ROADMAP_PHASES: { types: SessionType[]; label: string; href: string }[] = [
  { types: ["training_makeup_hair"], label: "Training Makeup & Tóc", href: "/student/makeup-journey/training" },
  { types: ["practice_makeup_hair"], label: "Thực hành Makeup & Tóc", href: "/student/makeup-journey/practice" },
  { types: ["training_hair"], label: "Training Tóc", href: "/student/makeup-journey/hair" },
  { types: ["practice_hair"], label: "Thực hành Tóc", href: "/student/makeup-journey/hair" },
  { types: ["extracurricular"], label: "Ngoại khóa", href: "/student/makeup-journey" },
];

const BOTTOM_NAV: { key: string; label: string; href: string; icon: typeof Home }[] = [
  { key: "home", label: "Trang chủ", href: "/student", icon: Home },
  { key: "schedule", label: "Lộ trình", href: "/student/makeup-journey", icon: CalendarDays },
  { key: "training", label: "Training", href: "/student/makeup-journey/training", icon: ClipboardList },
  { key: "practice", label: "Thực hành", href: "/student/makeup-journey/practice", icon: Sparkles },
  { key: "hair", label: "Bới tóc", href: "/student/makeup-journey/hair", icon: Scissors },
];

// --- date helpers -------------------------------------------------------
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("T")[0].split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
const fmtShort = (d: Date) => d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
const isTodayD = (d: Date) => startOfDay(d).getTime() === startOfDay(new Date()).getTime();

function pct(score: number, max: number) {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

// =========================================================================
export function MakeupJourney({ view }: { view: JourneyView }) {
  const [journey, setJourney] = useState<Journey | null | undefined>(undefined);
  const [mode, setMode] = useState<"demo" | "production" | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/student/makeup-journey", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { mode?: "demo" | "production"; journey?: Journey | null } | null;
    setMode(payload?.mode ?? null);
    setJourney(payload?.journey ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Full-screen takeover — lock the page behind it while this section is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onSubmissionSaved = useCallback((next: Submission) => {
    setJourney((current) => {
      if (!current) return current;
      const rest = current.submissions.filter((s) => s.classSessionId !== next.classSessionId);
      return { ...current, submissions: [...rest, next] };
    });
  }, []);

  const onAiAssessed = useCallback((next: AiAssessment) => {
    setJourney((current) => {
      if (!current) return current;
      const rest = current.aiAssessments.filter((a) => a.classSessionId !== next.classSessionId);
      return { ...current, aiAssessments: [next, ...rest] };
    });
  }, []);

  return (
    <div className={styles.appShell}>
      <AppTopbar />
      <div className={styles.appBody}>
        {journey === undefined ? (
          <p className={styles.muted}>Đang tải chương trình…</p>
        ) : mode === "demo" ? (
          <div className={styles.notice}><Sparkles size={16} /><div><strong>Chế độ demo</strong><p>Đăng nhập bằng tài khoản học viên thật để xem chương trình đào tạo của bạn.</p></div></div>
        ) : !journey ? (
          <section className={styles.emptyCard}>
            <GraduationCap size={34} />
            <h2>Bạn chưa được ghi danh vào lớp nào</h2>
            <p>Khi giảng viên hoặc Academy thêm bạn vào một lớp Makeup Chuyên nghiệp, toàn bộ chương trình 60 buổi sẽ hiện ở đây kèm chỗ nộp minh chứng.</p>
            <Link href="/student/courses" className={styles.linkBtn}>Về trang khóa học</Link>
          </section>
        ) : (
          <JourneyBody journey={journey} view={view} onSubmissionSaved={onSubmissionSaved} onAiAssessed={onAiAssessed} />
        )}
      </div>
      <BottomNav view={view} />
    </div>
  );
}

function AppTopbar() {
  return (
    <header className={styles.appTopbar}>
      <Link href="/student" className={styles.appBrand}><span>H₂</span><b>H2OBOOK</b></Link>
      <div className={styles.appTopActions}>
        <button type="button" aria-label="Thông báo" className={styles.iconBtn}><Bell size={18} /></button>
        <Link href="/student/profile" className={styles.appAvatar} aria-label="Hồ sơ">HV</Link>
      </div>
    </header>
  );
}

function BottomNav({ view }: { view: JourneyView }) {
  return (
    <nav className={styles.bottomNav}>
      {BOTTOM_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.key} href={item.href} data-active={item.key !== "home" && item.key === view ? "" : undefined}>
            <Icon size={18} />
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}

function JourneyBody({ journey, view, onSubmissionSaved, onAiAssessed }: {
  journey: Journey; view: JourneyView; onSubmissionSaved: (s: Submission) => void; onAiAssessed: (a: AiAssessment) => void;
}) {
  const { class: klass, sessions, evaluations } = journey;
  const meta = VIEW_META[view];
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const totalSessions = klass.totalSessions || 60;
  const overallPct = totalSessions ? Math.round((completedCount / totalSessions) * 100) : 0;
  const gradedPercents = evaluations.filter((e) => e.maxScore > 0).map((e) => pct(e.totalScore, e.maxScore));
  const avgScore = gradedPercents.length ? Math.round(gradedPercents.reduce((a, b) => a + b, 0) / gradedPercents.length) : null;

  return <>
    <HeroCard name={klass.name} code={klass.code} progressPct={overallPct} />
    <ProgressStrip completed={completedCount} total={totalSessions} graded={evaluations.length} avgScore={avgScore} />
    <RoadmapList sessions={sessions} />
    <p className={styles.viewSub}>{meta.title.toUpperCase()} · {meta.sub}</p>
    <LaneWorkspace journey={journey} view={view} onSubmissionSaved={onSubmissionSaved} onAiAssessed={onAiAssessed} />
  </>;
}

function HeroCard({ name, code, progressPct }: { name: string; code: string; progressPct: number }) {
  return (
    <section className={styles.hero}>
      <div>
        <p className={styles.heroEyebrow}>CHƯƠNG TRÌNH ĐÀO TẠO</p>
        <h1 className={styles.heroTitle}>{name}</h1>
        <span className={styles.heroPill}>Mã lớp {code} · Lộ trình 60 buổi</span>
      </div>
      <div className={styles.heroRing} style={{ "--p": `${progressPct}%` } as React.CSSProperties}>
        <span>{progressPct}%</span>
      </div>
    </section>
  );
}

function ProgressStrip({ completed, total, graded, avgScore }: { completed: number; total: number; graded: number; avgScore: number | null }) {
  const donePct = total ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(total - completed, 0);
  return (
    <section className={styles.progressStrip}>
      <div className={styles.progressHead}>
        <div><small>TIẾN ĐỘ KHÓA HỌC</small><strong>{completed}/{total} buổi</strong></div>
        <span>{donePct}%</span>
      </div>
      <div className={styles.progressBar}><i style={{ width: `${donePct}%` }} /></div>
      <small className={styles.progressNote}>
        {graded} buổi đã chấm{avgScore !== null ? ` · điểm TB ${avgScore}%` : ""} · còn {remaining} buổi nữa để tốt nghiệp
      </small>
    </section>
  );
}

function RoadmapList({ sessions }: { sessions: ClassSession[] }) {
  const rows = ROADMAP_PHASES.map((p) => {
    const inPhase = sessions.filter((s) => p.types.includes(s.sessionType)).sort((a, b) => a.sessionNo - b.sessionNo);
    if (!inPhase.length) return null;
    const done = inPhase.filter((s) => s.status === "completed").length;
    const state = done === inPhase.length ? "Hoàn thành" : done > 0 ? "Đang học" : "Sắp tới";
    return {
      ...p,
      done,
      total: inPhase.length,
      range: `Buổi ${inPhase[0].sessionNo}–${inPhase[inPhase.length - 1].sessionNo}`,
      state,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  if (!rows.length) return null;

  return (
    <section className={styles.roadmap}>
      <h2 className={styles.roadmapHead}>Lộ trình khóa học</h2>
      <div className={styles.roadmapList}>
        {rows.map((r) => (
          <Link
            key={r.label}
            href={r.href}
            className={styles.roadmapItem}
            data-state={r.state === "Hoàn thành" ? "done" : r.state === "Đang học" ? "active" : "soon"}
          >
            <div className={styles.roadmapDot}>{r.state === "Hoàn thành" ? "✓" : r.done > 0 ? r.done : "○"}</div>
            <div className={styles.roadmapCopy}>
              <span>{r.range}</span>
              <strong>{r.label}</strong>
              <small>{r.done}/{r.total} buổi · {r.state}</small>
            </div>
            <div className={styles.roadmapBar}><i style={{ width: `${Math.round((r.done / r.total) * 100)}%` }} /></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// =========================================================================
function LaneWorkspace({ journey, view, onSubmissionSaved, onAiAssessed }: {
  journey: Journey; view: JourneyView; onSubmissionSaved: (s: Submission) => void; onAiAssessed: (a: AiAssessment) => void;
}) {
  const evaluationBySession = useMemo(() => new Map(journey.evaluations.map((e) => [e.classSessionId, e])), [journey.evaluations]);
  const aiBySession = useMemo(() => new Map(journey.aiAssessments.map((a) => [a.classSessionId, a])), [journey.aiAssessments]);
  const submissionBySession = useMemo(() => new Map(journey.submissions.map((s) => [s.classSessionId, s])), [journey.submissions]);
  const rubricByCategory = useMemo(() => new Map(journey.rubrics.map((r) => [r.category, r])), [journey.rubrics]);

  const hasRealDates = useMemo(() => journey.sessions.some((s) => s.sessionDate), [journey.sessions]);
  const anchor = useMemo(() => {
    const d = journey.class.startedAt ? new Date(journey.class.startedAt) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : startOfDay(d);
  }, [journey.class.startedAt]);
  const synthDate = useCallback((no: number) => {
    let d = addDays(anchor, (no - 1) * 2);
    if (d.getDay() === 0) d = addDays(d, 1);
    return d;
  }, [anchor]);

  const types = VIEW_META[view].types;
  const items = useMemo(() => {
    const list = types === null ? journey.sessions : journey.sessions.filter((s) => types.includes(s.sessionType));
    return list.slice().sort((a, b) => a.sessionNo - b.sessionNo).map((session) => ({
      session,
      date: session.sessionDate ? parseDateOnly(session.sessionDate) : !hasRealDates ? synthDate(session.sessionNo) : null,
      synthetic: !session.sessionDate && !hasRealDates,
    }));
  }, [journey.sessions, types, hasRealDates, synthDate]);

  const featured = useMemo(() => {
    const dated = items.filter((i) => i.date);
    if (dated.length) {
      const t = startOfDay(new Date()).getTime();
      const up = dated.filter((i) => i.date!.getTime() >= t).sort((a, b) => a.date!.getTime() - b.date!.getTime());
      return up[0] ?? [...dated].sort((a, b) => b.date!.getTime() - a.date!.getTime())[0];
    }
    return items[0] ?? null;
  }, [items]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.session.id === selectedId) ?? featured ?? items[0] ?? null;

  const statusOf = (s: ClassSession): "graded" | "submitted" | "none" =>
    evaluationBySession.get(s.id) ? "graded"
      : (submissionBySession.get(s.id)?.assetIds.length ?? 0) > 0 ? "submitted"
      : "none";

  const detailProps = (session: ClassSession) => ({
    session,
    organizationId: journey.class.organizationId,
    rubric: rubricByCategory.get(RUBRIC_FOR_TYPE[session.sessionType] ?? null) ?? null,
    evaluation: evaluationBySession.get(session.id) ?? null,
    submission: submissionBySession.get(session.id) ?? null,
    aiAssessment: aiBySession.get(session.id) ?? null,
    onSaved: onSubmissionSaved,
    onAiAssessed,
  });

  if (!items.length) return <p className={styles.muted}>Chưa có buổi nào thuộc nhóm này. Giảng viên sẽ bổ sung vào lịch.</p>;

  return <div>
    {featured && (
      <button type="button" className={styles.todayCard} onClick={() => setSelectedId(featured.session.id)}>
        <div className={styles.todayBox}><b>{featured.session.sessionNo}</b><span>BUỔI</span></div>
        <div className={styles.todayCopy}>
          <span>
            {featured.date ? (isTodayD(featured.date) ? "Hôm nay" : featured.date.getTime() >= startOfDay(new Date()).getTime() ? "Buổi tiếp theo" : "Buổi gần nhất") : "Buổi tiếp theo"}
            {featured.date ? ` · ${fmtShort(featured.date)}` : ""}
          </span>
          <strong>{SESSION_TYPE_LABEL[featured.session.sessionType]}{featured.session.title ? ` · ${featured.session.title}` : ""}</strong>
          <small>
            {statusOf(featured.session) === "graded" ? "Đã chấm điểm"
              : statusOf(featured.session) === "submitted" ? "Đã nộp minh chứng · chờ chấm"
              : "Chưa nộp minh chứng"}
          </small>
        </div>
        <div className={styles.todayArrow}>›</div>
      </button>
    )}

    {!hasRealDates && (
      <p className={styles.calHint}>Ngày học đang hiển thị <b>theo dự kiến</b>. Khi giảng viên xếp lịch chính thức, ngày sẽ tự cập nhật.</p>
    )}

    <div className={styles.laneList}>
      {items.map((it) => {
        const st = statusOf(it.session);
        return (
          <button
            key={it.session.id}
            type="button"
            className={styles.laneRow}
            data-active={selected?.session.id === it.session.id ? "" : undefined}
            onClick={() => setSelectedId(it.session.id)}
          >
            <div className={styles.laneBox} data-cat={CATEGORY_FOR_TYPE[it.session.sessionType]}>{it.session.sessionNo}</div>
            <div className={styles.laneCopy}>
              <strong>{SESSION_TYPE_LABEL[it.session.sessionType]}{it.session.title ? ` · ${it.session.title}` : ""}</strong>
              <small>{it.date ? fmtShort(it.date) : "Chưa xếp lịch"}{it.synthetic ? " · dự kiến" : ""}</small>
            </div>
            <span className={styles.pill} data-tone={st === "graded" ? "done" : st === "submitted" ? "info" : undefined}>
              {st === "graded" ? "Đã chấm" : st === "submitted" ? "Đã nộp" : "Chưa nộp"}
            </span>
          </button>
        );
      })}
    </div>

    {selected && (
      <div className={styles.workspaceCard}>
        <SessionDetail {...detailProps(selected.session)} />
      </div>
    )}
  </div>;
}

// =========================================================================
function SessionDetail({ session, organizationId, rubric, evaluation, submission, aiAssessment, onSaved, onAiAssessed }: {
  session: ClassSession;
  organizationId: string;
  rubric: Rubric | null;
  evaluation: Evaluation | null;
  submission: Submission | null;
  aiAssessment: AiAssessment | null;
  onSaved: (next: Submission) => void;
  onAiAssessed: (a: AiAssessment) => void;
}) {
  const [coachOpen, setCoachOpen] = useState(false);
  const hasEvidence = (submission?.assetIds.length ?? 0) > 0;
  return <div className={styles.detail}>
    <div className={styles.detailHead}>
      <strong>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</strong>
      <span className={styles.pill} data-tone={session.status === "completed" ? "done" : session.status === "cancelled" ? "off" : undefined}>
        {SESSION_STATUS_LABEL[session.status]}
      </span>
    </div>
    {session.title && <p className={styles.detailTitle}>{session.title}</p>}

    <SessionEvidence sessionId={session.id} organizationId={organizationId} submission={submission} locked={Boolean(evaluation)} onSaved={onSaved} />

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

    {(rubric?.criteria.length ?? 0) > 0 && (
      <AiDraftSection
        sessionId={session.id}
        assessment={aiAssessment}
        canRun={hasEvidence}
        onAiAssessed={onAiAssessed}
        onOpenCoach={() => setCoachOpen(true)}
      />
    )}

    {coachOpen && <AICoachSheet sessionId={session.id} sessionTitle={`Buổi ${session.sessionNo}${session.title ? ` · ${session.title}` : ""}`} onClose={() => setCoachOpen(false)} />}
  </div>;
}

function AiDraftSection({ sessionId, assessment, canRun, onAiAssessed, onOpenCoach }: {
  sessionId: string;
  assessment: AiAssessment | null;
  canRun: boolean;
  onAiAssessed: (a: AiAssessment) => void;
  onOpenCoach: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setRunning(true); setMessage(null);
    try {
      const response = await fetch("/api/student/makeup-journey/ai-assess", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classSessionId: sessionId }),
      });
      const payload = await response.json().catch(() => null) as { assessment?: AiAssessment; error?: string } | null;
      if (!response.ok || !payload?.assessment) {
        setMessage(payload?.error === "NO_RUBRIC_FOR_SESSION" ? "Buổi này chưa có rubric để AI chấm." : "Không chạy được phân tích AI. Bài nộp của bạn vẫn được giữ.");
        return;
      }
      onAiAssessed(payload.assessment);
    } finally {
      setRunning(false);
    }
  }

  const a = assessment;
  return <div className={styles.aiCard}>
    <div className={styles.aiHead}>
      <strong>✦ Phân tích bằng AI</strong>
      <span className={styles.aiDraftTag}>NHÁP · không phải điểm chính thức</span>
    </div>

    {a && a.status === "ai_draft" && (
      <>
        <div className={styles.aiScore}>
          <div><small>Điểm AI (nháp)</small><strong>{a.totalScore ?? "—"}<i>/{a.maxScore}</i></strong></div>
          <span className={styles.pill} data-tone="info">{a.provider === "mock" ? "AI demo" : a.provider}</span>
        </div>
        {a.summary && <p className={styles.aiSummary}>{a.summary}</p>}
        {a.rubricSnapshot.length > 0 && (
          <ul className={styles.criteriaList}>
            {a.rubricSnapshot.map((c) => {
              const s = a.criterionScores[c.id];
              return <li key={c.id}>
                <span>{c.label}{s?.issue ? <em className={styles.aiIssue}> · {s.issue}</em> : null}</span>
                <b>{s ? `${s.score} / ${c.maxScore}` : `— / ${c.maxScore}`}</b>
              </li>;
            })}
          </ul>
        )}
        {a.priorityFixes.length > 0 && (
          <div className={styles.aiFixes}>
            <strong>Ưu tiên sửa</strong>
            {a.priorityFixes.map((f, i) => <div key={f}><b>{i + 1}</b><span>{f}</span></div>)}
          </div>
        )}
        <small className={styles.aiTime}>AI chấm lúc {new Date(a.createdAt).toLocaleString("vi-VN")}</small>
      </>
    )}

    {a && a.status === "unavailable" && (
      <p className={styles.aiSummary}>AI tạm thời không khả dụng ({a.provider}). Bài nộp của bạn vẫn được lưu — thử lại sau.</p>
    )}

    {message && <p className={styles.aiSummary} style={{ color: "#b22949" }}>{message}</p>}

    {!canRun && !a && <p className={styles.aiSummary}>Tải minh chứng (ảnh) trước để AI phân tích.</p>}

    <div className={styles.aiActions}>
      <button type="button" className={styles.primaryBtn} disabled={running || !canRun} onClick={run}>
        {running ? "Đang phân tích…" : a ? "Phân tích lại" : "✦ Phân tích bằng AI"}
      </button>
      {a && a.status === "ai_draft" && (
        <button type="button" className={styles.aiCoachBtn} onClick={onOpenCoach}>Hỏi H2O Copilot</button>
      )}
    </div>
    <p className={styles.aiPrivacy}>AI chỉ dùng ảnh bài nộp + rubric của buổi học. Điểm chính thức do giảng viên quyết định.</p>
  </div>;
}

function AICoachSheet({ sessionId, sessionTitle, onClose }: { sessionId: string; sessionTitle: string; onClose: () => void }) {
  const [messages, setMessages] = useState<{ id: string; role: "user" | "assistant"; content: string }[]>([
    { id: "welcome", role: "assistant", content: `Mình là H2O Learning Copilot cho ${sessionTitle}. Mình chỉ dùng rubric giảng viên đã cài cho buổi này.` },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(content: string) {
    const c = content.trim();
    if (!c || loading) return;
    const userMsg = { id: crypto.randomUUID(), role: "user" as const, content: c };
    const next = [...messages, userMsg];
    setMessages(next); setText(""); setLoading(true);
    try {
      const response = await fetch("/api/student/makeup-journey/ai-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classSessionId: sessionId, messages: next.filter((m) => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content })) }),
      });
      const payload = await response.json().catch(() => null) as { reply?: string } | null;
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: payload?.reply ?? "Xin lỗi, chưa phản hồi được." }]);
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: "Lỗi kết nối — thử lại nhé." }]);
    } finally {
      setLoading(false);
    }
  }

  return <>
    <div className={styles.coachBackdrop} onClick={onClose} />
    <section className={styles.coachSheet} role="dialog" aria-label="H2O Learning Copilot">
      <div className={styles.coachHead}>
        <div><small>✦ H2O Learning Copilot</small><strong>{sessionTitle}</strong></div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={16} /></button>
      </div>
      <div className={styles.coachBody}>
        {messages.map((m) => <div key={m.id} className={styles.bubble} data-role={m.role}>{m.content}</div>)}
        {loading && <div className={styles.bubble} data-role="assistant">Đang soạn…</div>}
      </div>
      <div className={styles.coachQuick}>
        {["Em sai ở đâu nhiều nhất?", "Cho checklist làm lại", "Ưu tiên sửa gì trước?", "So với buổi trước?"].map((q) => (
          <button key={q} type="button" onClick={() => send(q)}>{q}</button>
        ))}
      </div>
      <div className={styles.coachInput}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhập câu hỏi…" onKeyDown={(e) => e.key === "Enter" && send(text)} />
        <button type="button" onClick={() => send(text)} aria-label="Gửi">➤</button>
      </div>
    </section>
  </>;
}

function SessionEvidence({ sessionId, organizationId, submission, locked, onSaved }: {
  sessionId: string;
  organizationId: string;
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
        const asset = await uploadAsset(file, { organizationId, category: "student-competency", assetType: "image", compress: true });
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
        const code = payload?.error;
        setMessage(
          code === "STUDENT_NOT_IN_CLASS" ? "Bạn không còn trong lớp này."
            : code === "INVALID_EVIDENCE_ASSET" ? "Ảnh chưa lưu được lên máy chủ (kho lưu trữ chưa cấu hình). Báo quản trị."
            : code ? `Không lưu được minh chứng (${code}).`
            : "Không lưu được minh chứng."
        );
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
      <button type="button" className={styles.primaryBtn} disabled={saving || uploading || !dirty} onClick={save}>
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
