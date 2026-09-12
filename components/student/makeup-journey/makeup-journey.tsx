"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, Home, ImagePlus, Scissors, Sparkles, X } from "lucide-react";
import { uploadAsset, resolveAssetUrl } from "@/lib/assets/asset-client";
import { SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import { MAKEUP_PRODUCT_IMAGE_RUBRIC, isMakeupProductImageRubric } from "@/lib/student-competency/makeup-product-rubric";
import styles from "./makeup-journey.module.css";

// ---------------------------------------------------------------------------
// Shapes mirror lib/student-competency/service.ts::getOwnClassJourney (ClassJourney).
// ---------------------------------------------------------------------------
type SessionStatus = "scheduled" | "completed" | "cancelled";
interface ClassSession { id: string; sessionNo: number; sessionType: SessionType; title: string; sessionDate: string | null; status: SessionStatus }
interface RubricCriterion { id: string; title: string; description: string; maxScore: number; required: boolean; skillKey?: string }
interface Rubric { id: string; title: string; category: "training" | "makeup" | "hair" | "makeup_product" | null; criteria: RubricCriterion[] }
interface ProductRubricCriterion { id: string; label: string; description?: string; maxScore: number }
interface Evaluation { classSessionId: string; totalScore: number; maxScore: number; criterionScores: Record<string, number>; notes: string; assetIds: string[]; updatedAt: string }
interface Submission {
  classSessionId: string;
  assetIds: string[];
  note: string;
  rubricId: string | null;
  rubricVersionLabel: string;
  criterionScores: Record<string, number>;
  totalScore: number | null;
  maxScore: number | null;
  durationMinutes: number | null;
  repairPlan: RepairPlanItem[];
  updatedAt: string;
}
interface LocalAssessmentDraft {
  savedAt: number;
  assetIds?: string[];
  note?: string;
  criterionScores?: Record<string, number>;
  durationMinutes?: string;
  repairPlan?: RepairPlanItem[];
}
type RepairAction = "practice_again" | "review_demo" | "ask_teacher";
interface RepairPlanItem {
  criterionId: string;
  action: RepairAction;
  issue: string;
  nextStep: string;
  completed: boolean;
}
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
// GET /api/student/makeup-journey `ai` — describes the wired pre-check engine, never a key.
interface AiInfo { provider: string; model: string | null; live: boolean }

const MAX_EVIDENCE = 6;
const MAKEUP_PHOTO_GUIDE = [
  "Toàn mặt chính diện",
  "Góc nghiêng 45°",
  "Cận nền & má",
  "Cận lông mày",
  "Cận mắt & mi",
  "Cận son môi",
] as const;
const REPAIR_ACTION_LABEL: Record<RepairAction, string> = {
  practice_again: "Luyện lại theo quy trình",
  review_demo: "Xem lại Demo và ghi chép",
  ask_teacher: "Nhờ giáo viên kiểm tra",
};

export type JourneyView = "schedule" | "training" | "practice" | "hair";

const VIEWS: { key: JourneyView; label: string; href: string }[] = [
  { key: "schedule", label: "Lịch học", href: "/student/makeup-journey" },
  { key: "training", label: "Học training", href: "/student/makeup-journey/training" },
  { key: "practice", label: "Học thực hành", href: "/student/makeup-journey/practice" },
  { key: "hair", label: "Bới tóc", href: "/student/makeup-journey/hair" }
];

const VIEW_META: Record<JourneyView, { title: string; sub: string; types: SessionType[] | null }> = {
  schedule: { title: "Lịch học", sub: "Toàn bộ các buổi của chương trình, xếp theo lịch.", types: null },
  training: { title: "Học training", sub: "Các buổi Training Makeup & Tóc — quan sát, nghe giảng, ghi chép.", types: ["training_makeup_hair"] },
  practice: { title: "Học thực hành", sub: "Các buổi thực hành Makeup & Tóc trên mẫu.", types: ["practice_makeup_hair"] },
  hair: { title: "Bới tóc", sub: "Các buổi Training Tóc và thực hành Tóc.", types: ["training_hair", "practice_hair"] }
};

const CATEGORY_FOR_TYPE: Record<SessionType, "training" | "makeup" | "hair" | "extra"> = {
  training_makeup_hair: "training",
  training_hair: "training",
  practice_makeup_hair: "makeup",
  practice_hair: "hair",
  extracurricular: "extra"
};
const RUBRIC_FOR_TYPE: Partial<Record<SessionType, "training" | "makeup" | "hair">> = {
  training_makeup_hair: "training", training_hair: "training",
  practice_makeup_hair: "makeup", practice_hair: "hair"
};
const SESSION_TYPE_SHORT: Record<SessionType, string> = {
  training_makeup_hair: "Training M&T",
  training_hair: "Training Tóc",
  practice_makeup_hair: "TH Makeup",
  practice_hair: "TH Tóc",
  extracurricular: "Ngoại khóa"
};
const SESSION_STATUS_LABEL: Record<SessionStatus, string> = { scheduled: "Chưa diễn ra", completed: "Đã học", cancelled: "Đã huỷ" };
const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Roadmap phases = the curriculum's session-type blocks, in order (mobile only).
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

const JOURNEY_CARDS = [
  { title: "Nhật ký 90 ngày", body: "Mỗi buổi lưu ảnh, ghi chú, rubric và phản hồi." },
  { title: "Skill Map tự cập nhật", body: "Chỉ cập nhật sau khi giảng viên duyệt điểm." },
  { title: "Portfolio Evidence", body: "Ảnh đạt yêu cầu có thể đưa vào portfolio." },
];
const FLOW_LINE = "Tải bộ ảnh Makeup → Phân tích sản phẩm → Học viên tự đánh giá & chữa bài → Giáo viên đối chiếu → Kết quả cuối buổi → Skill Map → Portfolio.";
const AI_NOTE = "Phân tích ảnh dùng bộ tiêu chí sản phẩm Makeup riêng. Tự đánh giá dùng rubric quá trình học; kết quả chính thức vẫn do giáo viên duyệt.";

// --- date helpers (no external dep) ---------------------------------------
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isoKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("T")[0].split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
const fmtShort = (d: Date) => d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
const isTodayD = (d: Date) => startOfDay(d).getTime() === startOfDay(new Date()).getTime();

function pct(score: number, max: number) {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

function makeupTimeBand(minutes: number | null): number | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes <= 60) return 5;
  if (minutes <= 65) return 4;
  if (minutes <= 70) return 3;
  if (minutes <= 75) return 2;
  if (minutes <= 80) return 1;
  return 0;
}

function repairPlanSignature(plan: RepairPlanItem[]) {
  return JSON.stringify(plan.map((item) => ({
    criterionId: item.criterionId,
    action: item.action,
    issue: item.issue,
    nextStep: item.nextStep,
    completed: item.completed,
  })));
}

// Coaching bot V1 is a local, rubric-only pre-check (provider "mock", or a "local-http"/"ollama"
// gateway on the studio LAN). V2 = a hosted model (gemini/openai) grading higher-order criteria.
function isOfflineEngine(ai: AiInfo | null): boolean {
  return !ai || ai.provider === "mock" || ai.provider === "local-http" || ai.provider === "ollama";
}
function engineBadge(ai: AiInfo | null): string {
  if (!ai || ai.provider === "mock") return "OFFLINE";
  if (ai.provider === "local-http" || ai.provider === "ollama") return ai.live ? "LOCAL AI" : "OFFLINE";
  return ai.live ? "AI NÂNG CAO" : "OFFLINE";
}

type ChatMsg = { id: string; role: "user" | "assistant"; content: string; images?: string[] };
const COACH_QUICK = ["Em sai ở đâu nhiều nhất?", "Cho checklist làm lại", "Ưu tiên sửa gì trước?", "Ảnh còn thiếu minh chứng gì?"];

// Shared chat transcript for one session — used by the mobile bottom sheet and the desktop
// Chat Coach tab. The desktop panel also injects photo-attach and assessment-result messages.
function useCoachThread(sessionId: string, sessionTitle: string) {
  const welcome = (): ChatMsg[] => [
    { id: "welcome", role: "assistant", content: `Mình là H2O Learning Copilot cho ${sessionTitle}. Em gửi bộ ảnh Makeup vào đây, mình đối chiếu 9 tiêu chí sản phẩm rồi trả phần cần sửa. Kết quả cuối buổi vẫn do giảng viên duyệt.` },
  ];
  const [messages, setMessages] = useState<ChatMsg[]>(welcome);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMessages(welcome()); /* reset when the selected session changes */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionTitle]);

  const append = useCallback((m: ChatMsg) => setMessages((cur) => [...cur, m]), []);

  const send = useCallback(async (raw: string) => {
    const c = raw.trim();
    if (!c || loading) return;
    const mine: ChatMsg = { id: crypto.randomUUID(), role: "user", content: c };
    setMessages((cur) => [...cur, mine]);
    setLoading(true);
    try {
      const history = [...messages, mine].filter((m) => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/student/makeup-journey/ai-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classSessionId: sessionId, messages: history }),
      });
      const payload = await res.json().catch(() => null) as { reply?: string } | null;
      append({ id: crypto.randomUUID(), role: "assistant", content: payload?.reply ?? "Xin lỗi, chưa phản hồi được." });
    } catch {
      append({ id: crypto.randomUUID(), role: "assistant", content: "Lỗi kết nối — thử lại nhé." });
    } finally {
      setLoading(false);
    }
  }, [append, loading, messages, sessionId]);

  return { messages, loading, send, append };
}

// One session's rubric + latest evidence/grade/AI draft, resolved from the journey payload.
function sessionContext(journey: Journey, session: ClassSession) {
  const submission = journey.submissions.find((s) => s.classSessionId === session.id) ?? null;
  const rubric = (submission?.rubricId ? journey.rubrics.find((r) => r.id === submission.rubricId) : undefined)
    ?? journey.rubrics.find((r) => r.category === (RUBRIC_FOR_TYPE[session.sessionType] ?? null))
    ?? null;
  return {
    rubric,
    evaluation: journey.evaluations.find((e) => e.classSessionId === session.id) ?? null,
    submission,
    aiAssessment: journey.aiAssessments.find((a) => a.classSessionId === session.id) ?? null,
  };
}

// Below this width the section becomes a standalone mobile app (no sidebar, bottom nav);
// at or above it, the normal in-shell desktop layout (calendar + copilot panel) is used.
function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpoint]);
  return isMobile;
}

type JourneyRenderProps = {
  view: JourneyView;
  journey: Journey | null;
  mode: "demo" | "production" | null;
  aiInfo: AiInfo | null;
  onSubmissionSaved: (s: Submission) => void;
  onAiAssessed: (a: AiAssessment) => void;
};

// =========================================================================
export function MakeupJourney({ view }: { view: JourneyView }) {
  const [journey, setJourney] = useState<Journey | null | undefined>(undefined);
  const [mode, setMode] = useState<"demo" | "production" | null>(null);
  const [aiInfo, setAiInfo] = useState<AiInfo | null>(null);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    const response = await fetch("/api/student/makeup-journey", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { mode?: "demo" | "production"; journey?: Journey | null; ai?: AiInfo } | null;
    setMode(payload?.mode ?? null);
    setAiInfo(payload?.ai ?? null);
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

  const onAiAssessed = useCallback((next: AiAssessment) => {
    setJourney((current) => {
      if (!current) return current;
      const rest = current.aiAssessments.filter((a) => a.classSessionId !== next.classSessionId);
      return { ...current, aiAssessments: [next, ...rest] };
    });
  }, []);

  // Wait until both the viewport class and the journey payload are known — avoids an SSR
  // hydration mismatch and a layout that flips shape after mount.
  if (isMobile === null || journey === undefined) {
    return <p className={styles.bootLoading}>Đang tải chương trình…</p>;
  }

  const shared: JourneyRenderProps = { view, journey, mode, aiInfo, onSubmissionSaved, onAiAssessed };
  return isMobile ? <MobileJourney {...shared} /> : <DesktopJourney {...shared} />;
}

// =========================================================================
// DESKTOP — inside the shared StudentShell: calendar on the left, a persistent
// H2O Learning Copilot panel on the right (upload · offline rubric pre-check · chat).
// =========================================================================
function DesktopJourney({ view, journey, mode, aiInfo, onSubmissionSaved, onAiAssessed }: JourneyRenderProps) {
  const meta = VIEW_META[view];

  const head = (
    <section className="h2o-student-page-head">
      <div>
        <span>CHƯƠNG TRÌNH ĐÀO TẠO · {meta.title.toUpperCase()}</span>
        <h1>Chương trình đào tạo</h1>
        <p>Lịch học, minh chứng thực hành và đánh giá năng lực trong cùng một hành trình.</p>
      </div>
    </section>
  );

  const viewNav = (
    <nav className={styles.viewNav}>
      {VIEWS.map((v) => (
        <Link key={v.key} href={v.href} data-active={v.key === view}>{v.label}</Link>
      ))}
    </nav>
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Reset the selection whenever the lane changes.
  useEffect(() => { setSelectedId(null); }, [view]);

  const laneSessions = useMemo(() => {
    const types = meta.types;
    const list = !journey ? [] : types === null ? journey.sessions : journey.sessions.filter((s) => types.includes(s.sessionType));
    return [...list].sort((a, b) => a.sessionNo - b.sessionNo);
  }, [journey, meta.types]);

  if (mode === "demo") {
    return <>{head}
      <div className={styles.notice}><Sparkles size={16} /><div><strong>Chế độ demo</strong><p>Đăng nhập bằng tài khoản học viên thật để xem chương trình đào tạo của bạn.</p></div></div>
    </>;
  }

  if (!journey) {
    return <>{head}
      <section className={styles.emptyCard}>
        <GraduationCap size={34} />
        <h2>Bạn chưa được ghi danh vào lớp nào</h2>
        <p>Khi giảng viên hoặc Academy thêm bạn vào một lớp Makeup Chuyên nghiệp, toàn bộ chương trình 60 buổi sẽ hiện ở đây theo lịch, kèm chỗ nộp minh chứng cho từng buổi.</p>
        <Link href="/student/courses" className={styles.linkBtn}>Về trang khóa học</Link>
      </section>
    </>;
  }

  const totalSessions = journey.class.totalSessions || 60;
  const selectedSession =
    laneSessions.find((s) => s.id === selectedId) ??
    laneSessions.find((s) => s.status !== "completed") ??
    laneSessions[laneSessions.length - 1] ??
    null;

  return <div className={styles.root}>
    <ClassBar journey={journey} />
    <p className={styles.viewSub}>{meta.sub}</p>
    {viewNav}
    <div className={styles.noteBanner}><Sparkles size={14} /><span>{AI_NOTE}</span></div>

    <div className={styles.copilotLayout}>
      <section className={styles.schedulePane} aria-label="Lịch học và buổi đang chọn">
        <CurriculumCalendar
          journey={journey}
          view={view}
          selectedId={selectedSession?.id ?? null}
          onSelect={setSelectedId}
        />
        <SessionSnapshot journey={journey} session={selectedSession} />
      </section>
      <CopilotPanel
        journey={journey}
        session={selectedSession}
        aiInfo={aiInfo}
        onSubmissionSaved={onSubmissionSaved}
        onAiAssessed={onAiAssessed}
      />
    </div>

    <JourneyFooter />
    <p className={styles.flowLine}><b>Luồng chuẩn:</b> {FLOW_LINE}</p>
    <p className={styles.viewSub} style={{ marginTop: 6 }}>Đã xếp {totalSessions} buổi cho lộ trình 3 tháng.</p>
  </div>;
}

function ClassBar({ journey }: { journey: Journey }) {
  const total = journey.class.totalSessions || 60;
  const learned = journey.sessions.filter((s) => s.status === "completed").length;
  const submitted = journey.submissions.filter((s) => s.assetIds.length > 0).length;
  const graded = journey.evaluations.filter((e) => e.maxScore > 0);
  const avg10 = graded.length
    ? (graded.reduce((sum, e) => sum + (e.totalScore / e.maxScore) * 10, 0) / graded.length).toFixed(1)
    : "—";
  return (
    <section className={styles.classBar}>
      <div>
        <strong>{journey.class.name}</strong>
        <span>Mã lớp {journey.class.code} · {total} buổi · 3 tháng</span>
      </div>
      <div className={styles.classMetrics}>
        <span><b>{learned}</b>/{total} đã học</span>
        <span><b>{submitted}</b> đã nộp</span>
        <span><b>{avg10}</b> điểm TB</span>
      </div>
    </section>
  );
}

function JourneyFooter() {
  return (
    <div className={styles.journeyFooter}>
      {JOURNEY_CARDS.map((c) => (
        <div key={c.title} className={styles.footCard}>
          <strong>{c.title}</strong>
          <span>{c.body}</span>
        </div>
      ))}
    </div>
  );
}

// The calendar is a navigator, not the main workspace. This compact summary answers the most
// important question immediately after a learner selects a date, while the full assessment work
// happens in the wider Copilot workspace beside it.
function SessionSnapshot({ journey, session }: { journey: Journey; session: ClassSession | null }) {
  if (!session) return null;
  const ctx = sessionContext(journey, session);
  const scorePercent = ctx.evaluation ? pct(ctx.evaluation.totalScore, ctx.evaluation.maxScore) : null;
  const date = session.sessionDate ? parseDateOnly(session.sessionDate).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }) : "Chưa xếp ngày chính thức";
  return <article className={styles.sessionSnapshot}>
    <div className={styles.snapshotHead}>
      <div>
        <small>BUỔI ĐANG CHỌN · {date}</small>
        <strong>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</strong>
        {session.title && <span>{session.title}</span>}
      </div>
      <span className={styles.pill} data-tone={ctx.evaluation ? "done" : (ctx.submission?.assetIds.length ?? 0) > 0 ? "info" : undefined}>{ctx.evaluation ? "Đã chấm" : (ctx.submission?.assetIds.length ?? 0) > 0 ? "Đã nộp" : "Chưa nộp"}</span>
    </div>
    <div className={styles.snapshotMetrics}>
      <span><small>Điểm giáo viên</small><b>{ctx.evaluation ? `${ctx.evaluation.totalScore}/${ctx.evaluation.maxScore}` : "—"}</b>{scorePercent != null && <em>{scorePercent}%</em>}</span>
      <span><small>Tự đánh giá</small><b>{ctx.submission?.totalScore != null ? `${ctx.submission.totalScore}/${ctx.submission.maxScore ?? 100}` : "Chưa chấm"}</b></span>
      <span><small>Minh chứng</small><b>{ctx.submission?.assetIds.length ?? 0}/6 ảnh</b></span>
    </div>
    {ctx.evaluation?.notes && <p className={styles.snapshotNote}><b>Nhận xét giáo viên:</b> {ctx.evaluation.notes}</p>}
    {!ctx.evaluation && <p className={styles.snapshotHint}>Chi tiết, ảnh, nhận xét AI và phần tự chữa bài đang mở ở không gian H2O Learning Copilot bên phải.</p>}
  </article>;
}

// =========================================================================
// The persistent Learning Copilot panel — bound to whichever session is selected.
// Flow: student drops photos in "Chat Coach" -> panel saves the submission and
// jumps to "Đánh giá ảnh" -> the rubric pre-check runs -> its result is posted
// back into the chat thread for the student to read.
// =========================================================================
function CopilotPanel({ journey, session, aiInfo, onSubmissionSaved, onAiAssessed }: {
  journey: Journey;
  session: ClassSession | null;
  aiInfo: AiInfo | null;
  onSubmissionSaved: (s: Submission) => void;
  onAiAssessed: (a: AiAssessment) => void;
}) {
  const [tab, setTab] = useState<"overview" | "chat" | "assess" | "self" | "rubric">("overview");
  const [autoAssessAt, setAutoAssessAt] = useState(0);
  const [attaching, setAttaching] = useState(false);
  const offline = isOfflineEngine(aiInfo);
  const ctx = session ? sessionContext(journey, session) : null;
  const configuredProductRubric = journey.rubrics.find((item) => item.category === "makeup_product");
  const productRubric: readonly ProductRubricCriterion[] = configuredProductRubric?.criteria.length
    ? configuredProductRubric.criteria.map((criterion) => ({ id: criterion.id, label: criterion.title, description: criterion.description, maxScore: criterion.maxScore }))
    : MAKEUP_PRODUCT_IMAGE_RUBRIC;
  const status = ctx?.evaluation ? "Đã chấm" : (ctx?.submission?.assetIds.length ?? 0) > 0 ? "Đã nộp" : "Chưa chấm";

  const thread = useCoachThread(
    session?.id ?? "none",
    session ? `Buổi ${session.sessionNo}${session.title ? ` · ${session.title}` : ""}` : "buổi học",
  );
  const previewUrls = useRef<string[]>([]);
  // True only for the assessment kicked off by a chat photo upload — that one bounces back to
  // Chat Coach with its result; a manual "Phân tích lại" on the Đánh giá ảnh tab stays put.
  const autoPendingRef = useRef(false);
  useEffect(() => () => { previewUrls.current.forEach(URL.revokeObjectURL); previewUrls.current = []; }, []);
  useEffect(() => { setTab("overview"); setAutoAssessAt(0); autoPendingRef.current = false; }, [session?.id]);

  const say = (content: string): ChatMsg => ({ id: crypto.randomUUID(), role: "assistant", content });

  async function attachPhotos(files: File[]) {
    if (!session || !ctx || attaching) return;
    const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, MAX_EVIDENCE);
    if (!imgs.length) { thread.append(say("File em gửi không phải ảnh. Chọn ảnh JPG hoặc PNG rồi bấm “Gửi ảnh” lại nhé.")); return; }
    const previews = imgs.map((f) => { const u = URL.createObjectURL(f); previewUrls.current.push(u); return u; });
    thread.append({ id: crypto.randomUUID(), role: "user", content: imgs.length > 1 ? `Em gửi ${imgs.length} ảnh cho buổi này.` : "Em gửi ảnh cho buổi này.", images: previews });
    setAttaching(true);
    try {
      const uploaded: string[] = [];
      const uploadErrors: string[] = [];
      for (const f of imgs) {
        try {
          const a = await uploadAsset(f, { organizationId: journey.class.organizationId, category: "student-competency", assetType: "image", compress: true });
          uploaded.push(a.assetId);
        } catch (error) {
          uploadErrors.push(error instanceof Error ? error.message : "UPLOAD_FAILED");
        }
      }
      if (!uploaded.length) {
        const detail = uploadErrors[0] ? ` Chi tiết: ${uploadErrors[0]}` : "";
        thread.append(say(`Chưa gửi được ảnh lên máy chủ.${detail} Em bấm “Gửi ảnh” thử lại ngay tại đây — không cần rời khỏi khung chat. Nếu vẫn lỗi, báo giúp mình dòng chi tiết này.`));
        return;
      }
      const merged = [...(ctx.submission?.assetIds ?? []), ...uploaded].slice(0, MAX_EVIDENCE);
      const res = await fetch("/api/student/makeup-journey/submission", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        // Keep a learner's self-assessment intact when they send another photo from Chat Coach.
        // The same submission row backs every Copilot tab.
        body: JSON.stringify({
          classSessionId: session.id,
          assetIds: merged,
          note: ctx.submission?.note ?? "",
          rubricId: ctx.rubric?.id ?? ctx.submission?.rubricId ?? undefined,
          criterionScores: ctx.submission?.criterionScores ?? {},
          durationMinutes: ctx.submission?.durationMinutes ?? undefined,
          repairPlan: ctx.submission?.repairPlan ?? [],
        }),
      });
      const payload = await res.json().catch(() => null) as { submission?: Submission; error?: string } | null;
      if (!res.ok || !payload?.submission) {
        const code = payload?.error;
        thread.append(say(
          code === "INVALID_EVIDENCE_ASSET" ? "Ảnh đã tải lên nhưng máy chủ chưa xác nhận được. Em gửi lại sau ít phút nhé."
            : code === "STUDENT_NOT_IN_CLASS" ? "Em hiện không còn trong lớp này nên chưa nộp được minh chứng."
            : `Chưa lưu được minh chứng${code ? ` (${code})` : ""}. Em bấm “Gửi ảnh” thử lại tại đây nhé.`,
        ));
        return;
      }
      onSubmissionSaved(payload.submission);
      if (uploaded.length < imgs.length) thread.append(say(`Có ${imgs.length - uploaded.length} ảnh chưa tải được, mình dùng ${uploaded.length} ảnh còn lại.`));
      thread.append(say("Đã nhận và lưu bộ ảnh. Mình chuyển sang tab “Đánh giá ảnh” để phân tích lớp nền, mày, mắt–mi, khối, má, môi và tổng thể layout…"));
      autoPendingRef.current = true;
      setTab("assess");
      setAutoAssessAt(Date.now());
    } catch (error) {
      thread.append(say(`Có lỗi khi xử lý ảnh: ${error instanceof Error ? error.message : "không rõ"}. Em thử lại tại khung chat nhé.`));
    } finally {
      setAttaching(false);
    }
  }

  // AiDraftSection reports here (in the panel) so a fresh draft can be summarised into the chat.
  function handleAssessed(a: AiAssessment) {
    onAiAssessed(a);
    if (a.status === "ai_draft") {
      const parts = [`Kết quả phân tích sản phẩm Makeup: ${a.totalScore ?? "—"}/${a.maxScore}.`];
      if (a.summary) parts.push(a.summary);
      if (a.priorityFixes.length) parts.push("Ưu tiên sửa:\n" + a.priorityFixes.slice(0, 3).map((f, i) => `${i + 1}. ${f}`).join("\n"));
      parts.push("Đây là điểm nháp — giảng viên sẽ chấm chính thức.");
      thread.append(say(parts.join("\n\n")));
    } else {
      thread.append(say("Bộ đánh giá tạm thời không khả dụng — ảnh của em vẫn được lưu, thử lại sau nhé."));
    }
    // Only jump to Chat Coach when this run was the one auto-started by a chat photo upload.
    if (autoPendingRef.current) { autoPendingRef.current = false; setTab("chat"); }
  }

  return (
    <aside className={styles.copilot}>
      <div className={styles.copilotHead}>
        <div className={styles.copilotAvatar}>✦</div>
        <div className={styles.copilotId}>
          <strong>H2O Learning Copilot</strong>
          <small>{offline ? "Makeup Photo Review · Local-first" : "Makeup Vision · Online"}</small>
        </div>
        <span className={styles.copilotBadge} data-live={!offline && aiInfo?.live ? "" : undefined}>{engineBadge(aiInfo)}</span>
      </div>

      <div className={styles.copilotTabs} role="tablist" aria-label="Công cụ học tập cho buổi đã chọn">
        <button type="button" role="tab" aria-selected={tab === "overview"} data-active={tab === "overview" || undefined} onClick={() => setTab("overview")}>Kết quả cuối buổi</button>
        <button type="button" role="tab" aria-selected={tab === "chat"} data-active={tab === "chat" || undefined} onClick={() => setTab("chat")}>Chat Coach</button>
        <button type="button" role="tab" aria-selected={tab === "assess"} data-active={tab === "assess" || undefined} onClick={() => setTab("assess")}>Đánh giá ảnh</button>
        <button type="button" role="tab" aria-selected={tab === "self"} data-active={tab === "self" || undefined} onClick={() => setTab("self")}>Tự đánh giá</button>
        <button type="button" role="tab" aria-selected={tab === "rubric"} data-active={tab === "rubric" || undefined} onClick={() => setTab("rubric")}>Bộ tiêu chí</button>
      </div>

      {!session || !ctx ? (
        <p className={styles.copilotEmpty}>Chọn một buổi trong lịch để trò chuyện và nộp minh chứng.</p>
      ) : (
        <div className={styles.copilotBody}>
          <div className={styles.copilotSession}>
            <div><small>BUỔI HỌC ĐANG CHỌN</small><strong>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</strong></div>
            <span className={styles.pill} data-tone={ctx.evaluation ? "done" : (ctx.submission?.assetIds.length ?? 0) > 0 ? "info" : undefined}>{status}</span>
          </div>

          <div className={styles.copilotPane} hidden={tab !== "overview"}>
            <SessionOverview session={session} ctx={ctx} onNavigate={setTab} />
          </div>
          <div className={styles.copilotPane} hidden={tab !== "chat"}>
            <div className={styles.copilotChat}>
              <CoachConversation
                messages={thread.messages}
                loading={thread.loading || attaching}
                onSend={thread.send}
                onAttach={ctx.evaluation ? undefined : attachPhotos}
              />
            </div>
          </div>
          <div className={styles.copilotPane} hidden={tab !== "assess"}>
            <SessionDetail
              key={session.id}
              session={session}
              organizationId={journey.class.organizationId}
              rubric={ctx.rubric}
              evaluation={ctx.evaluation}
              submission={ctx.submission}
              aiAssessment={ctx.aiAssessment}
              aiInfo={aiInfo}
              autoAssessAt={autoAssessAt}
              onConsumeAutoRun={() => setAutoAssessAt(0)}
              onSaved={onSubmissionSaved}
              onAiAssessed={handleAssessed}
              onRequestCoach={() => setTab("chat")}
              variant="panel"
              content="evidence"
            />
          </div>
          <div className={styles.copilotPane} hidden={tab !== "self"}>
            <SessionDetail
              key={`${session.id}-self`}
              session={session}
              organizationId={journey.class.organizationId}
              rubric={ctx.rubric}
              evaluation={ctx.evaluation}
              submission={ctx.submission}
              aiAssessment={ctx.aiAssessment}
              productRubric={productRubric}
              onSaved={onSubmissionSaved}
              onAiAssessed={handleAssessed}
              variant="panel"
              content="self"
            />
          </div>
          <div className={styles.copilotPane} hidden={tab !== "rubric"}>
            <RubricSummary rubric={ctx.rubric} productRubric={productRubric} detailed />
          </div>
        </div>
      )}
    </aside>
  );
}

function SessionOverview({ session, ctx, onNavigate }: {
  session: ClassSession;
  ctx: ReturnType<typeof sessionContext>;
  onNavigate: (tab: "overview" | "chat" | "assess" | "self" | "rubric") => void;
}) {
  const evaluation = ctx.evaluation;
  const submission = ctx.submission;
  const imageAssessment = ctx.aiAssessment && isMakeupProductImageRubric(ctx.aiAssessment.rubricSnapshot) ? ctx.aiAssessment : null;
  const percent = evaluation ? pct(evaluation.totalScore, evaluation.maxScore) : null;
  const imagePercent = imageAssessment?.totalScore != null ? pct(imageAssessment.totalScore, imageAssessment.maxScore) : null;
  const selfPercent = submission?.totalScore != null ? pct(submission.totalScore, submission.maxScore ?? 100) : null;
  const preliminaryPercent = imagePercent != null && selfPercent != null
    ? Math.round(imagePercent * .7 + selfPercent * .3)
    : imagePercent ?? selfPercent;
  const completedSources = [imagePercent, selfPercent, percent].filter((score) => score != null).length;
  const heroScore = evaluation
    ? `${evaluation.totalScore}/${evaluation.maxScore}`
    : preliminaryPercent != null ? `${preliminaryPercent}/100` : "—";
  return <div className={styles.sessionOverview}>
    <div className={styles.overviewHero}>
      <div>
        <small>KẾT QUẢ BUỔI {session.sessionNo}</small>
        <strong>{evaluation ? "Kết quả cuối buổi đã được giáo viên duyệt" : completedSources >= 2 ? "Đã có kết quả tổng hợp tạm thời" : submission?.assetIds.length ? "Đã nộp ảnh, tiếp tục hoàn thiện đánh giá" : "Bắt đầu đánh giá buổi học"}</strong>
        <span>{SESSION_TYPE_LABEL[session.sessionType]}{session.title ? ` · ${session.title}` : ""}</span>
      </div>
      <b>{heroScore}<i>{evaluation ? "điểm chính thức" : preliminaryPercent != null ? "tạm tính" : "chưa chấm"}</i></b>
    </div>

    <div className={styles.resultSources}>
      <article data-ready={imagePercent != null || undefined}>
        <small>SẢN PHẨM MAKEUP</small><strong>{imagePercent != null ? `${imagePercent}/100` : "Chưa phân tích"}</strong><span>Đánh giá từ bộ ảnh</span>
      </article>
      <article data-ready={selfPercent != null || undefined}>
        <small>TỰ ĐÁNH GIÁ</small><strong>{selfPercent != null ? `${selfPercent}/100` : "Chưa tự chấm"}</strong><span>Quá trình học & chữa bài</span>
      </article>
      <article data-ready={percent != null || undefined}>
        <small>GIÁO VIÊN DUYỆT</small><strong>{percent != null ? `${percent}/100` : "Đang chờ"}</strong><span>Kết quả chính thức</span>
      </article>
    </div>
    {!evaluation && preliminaryPercent != null && <p className={styles.compositeNote}>Điểm tạm tính = 70% sản phẩm Makeup + 30% tự đánh giá khi có đủ hai phần. Giáo viên có quyền điều chỉnh và duyệt kết quả cuối buổi.</p>}

    <div className={styles.overviewActions}>
      <button type="button" onClick={() => onNavigate("assess")}>Phân tích ảnh Makeup</button>
      <button type="button" onClick={() => onNavigate("self")}>Tự đánh giá / chữa bài</button>
      <button type="button" onClick={() => onNavigate("rubric")}>Xem bộ tiêu chí</button>
    </div>

    {evaluation ? <>
      <section className={styles.overviewSection}>
        <div className={styles.overviewSectionHead}><strong>Điểm giáo viên theo tiêu chí</strong><span>Điểm chính thức</span></div>
        <ul className={styles.overviewCriteria}>
          {(ctx.rubric?.criteria ?? []).map((criterion) => {
            const score = evaluation.criterionScores[criterion.id] ?? 0;
            return <li key={criterion.id} data-low={score < criterion.maxScore * .6 || undefined}>
              <span>{criterion.title}</span>
              <b>{score}/{criterion.maxScore}</b>
            </li>;
          })}
        </ul>
      </section>
      {evaluation.notes && <section className={styles.overviewNote}><strong>Nhận xét của giáo viên</strong><p>{evaluation.notes}</p></section>}
    </> : <section className={styles.overviewEmpty}>
      <strong>Điểm chính thức sẽ xuất hiện sau khi giáo viên duyệt.</strong>
      <p>{submission?.totalScore != null ? `Bạn đã tự chấm ${submission.totalScore}/${submission.maxScore ?? 100}. Hãy hoàn thiện ảnh và kế hoạch tự chữa để giáo viên đối chiếu nhanh hơn.` : "Bắt đầu bằng cách tải ảnh sản phẩm hoặc tự đánh giá theo rubric của buổi này."}</p>
    </section>}

    {imageAssessment?.status === "ai_draft" && <section className={styles.overviewAi}>
      <strong>Nhận xét sản phẩm Makeup · {imageAssessment.totalScore ?? "—"}/{imageAssessment.maxScore}</strong>
      {imageAssessment.summary && <p>{imageAssessment.summary}</p>}
      {imageAssessment.priorityFixes.length > 0 && <ul>{imageAssessment.priorityFixes.slice(0, 3).map((fix) => <li key={fix}>{fix}</li>)}</ul>}
    </section>}
  </div>;
}

function RubricSummary({ rubric, productRubric, detailed = false }: { rubric: Rubric | null; productRubric: readonly ProductRubricCriterion[]; detailed?: boolean }) {
  const learningTotal = rubric?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) ?? 0;
  const productTotal = productRubric.reduce((sum, criterion) => sum + criterion.maxScore, 0);
  return (
    <div className={styles.rubricGroups}>
      <section className={styles.rubricSummary} data-product>
        <div className={styles.rubricSummaryHead}>
          <span>ĐÁNH GIÁ ẢNH</span>
          <strong>Sản phẩm Makeup · {productRubric.length} tiêu chí / {productTotal}đ</strong>
          <small>Dùng cho ảnh toàn mặt và các ảnh cận nền, mày, mắt–mi, má, môi.</small>
        </div>
        <ul className={styles.criteriaList}>
          {productRubric.map((criterion) => (
            <li key={criterion.id}>
              <span>{criterion.label}{detailed && criterion.description ? <em className={styles.rubricDesc}> — {criterion.description}</em> : null}</span>
              <b>{criterion.maxScore}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.rubricSummary}>
        <div className={styles.rubricSummaryHead}>
          <span>QUÁ TRÌNH HỌC</span>
          <strong>{rubric ? `${rubric.title} · ${rubric.criteria.length} tiêu chí / ${learningTotal}đ` : "Buổi này chưa gắn rubric quá trình học"}</strong>
          <small>Dùng cho tab Tự đánh giá và phần giáo viên kiểm tra trên lớp.</small>
        </div>
        {rubric && rubric.criteria.length > 0 && <ul className={styles.criteriaList}>
          {rubric.criteria.map((criterion) => (
            <li key={criterion.id}>
              <span>{criterion.title}{detailed && criterion.description ? <em className={styles.rubricDesc}> — {criterion.description}</em> : null}</span>
              <b>{criterion.maxScore}</b>
            </li>
          ))}
        </ul>}
      </section>
    </div>
  );
}

// =========================================================================
// MOBILE — full-screen takeover that escapes the shared shell: compact topbar,
// own scroll body, 5-icon bottom nav, roadmap list, inline lesson workspace.
// =========================================================================
function MobileJourney({ view, journey, mode, aiInfo, onSubmissionSaved, onAiAssessed }: JourneyRenderProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className={styles.appShell}>
      <AppTopbar />
      <div className={styles.appBody}>
        {mode === "demo" ? (
          <div className={styles.notice}><Sparkles size={16} /><div><strong>Chế độ demo</strong><p>Đăng nhập bằng tài khoản học viên thật để xem chương trình đào tạo của bạn.</p></div></div>
        ) : !journey ? (
          <section className={styles.emptyCard}>
            <GraduationCap size={34} />
            <h2>Bạn chưa được ghi danh vào lớp nào</h2>
            <p>Khi giảng viên hoặc Academy thêm bạn vào một lớp Makeup Chuyên nghiệp, toàn bộ chương trình 60 buổi sẽ hiện ở đây kèm chỗ nộp minh chứng.</p>
            <Link href="/student/courses" className={styles.linkBtn}>Về trang khóa học</Link>
          </section>
        ) : (
          <JourneyBody journey={journey} view={view} aiInfo={aiInfo} onSubmissionSaved={onSubmissionSaved} onAiAssessed={onAiAssessed} />
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

function JourneyBody({ journey, view, aiInfo, onSubmissionSaved, onAiAssessed }: {
  journey: Journey; view: JourneyView; aiInfo: AiInfo | null; onSubmissionSaved: (s: Submission) => void; onAiAssessed: (a: AiAssessment) => void;
}) {
  const { class: klass, sessions, evaluations } = journey;
  const meta = VIEW_META[view];
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const totalSessions = klass.totalSessions || 60;
  const overallPct = totalSessions ? Math.round((completedCount / totalSessions) * 100) : 0;
  const gradedPercents = evaluations.filter((e) => e.maxScore > 0).map((e) => pct(e.totalScore, e.maxScore));
  const avgScore = gradedPercents.length ? Math.round(gradedPercents.reduce((a, b) => a + b, 0) / gradedPercents.length) : null;

  return <>
    <details className={styles.mobileCourseOverview}>
      <summary>
        <div><small>KHÓA HỌC ĐANG HỌC</small><strong>{klass.name}</strong><span>Mã lớp {klass.code}</span></div>
        <b>{completedCount}/{totalSessions}<small> buổi</small></b>
      </summary>
      <div className={styles.mobileCourseOverviewBody}>
        <HeroCard name={klass.name} code={klass.code} progressPct={overallPct} />
        <ProgressStrip completed={completedCount} total={totalSessions} graded={evaluations.length} avgScore={avgScore} />
        <RoadmapList sessions={sessions} />
      </div>
    </details>
    <div className={styles.noteBanner}><Sparkles size={14} /><span>{AI_NOTE}</span></div>
    <p className={styles.viewSub}>{meta.title.toUpperCase()} · {meta.sub}</p>
    <LaneWorkspace journey={journey} view={view} aiInfo={aiInfo} onSubmissionSaved={onSubmissionSaved} onAiAssessed={onAiAssessed} />
    <JourneyFooter />
    <p className={styles.flowLine}><b>Luồng chuẩn:</b> {FLOW_LINE}</p>
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
function LaneWorkspace({ journey, view, aiInfo, onSubmissionSaved, onAiAssessed }: {
  journey: Journey; view: JourneyView; aiInfo: AiInfo | null; onSubmissionSaved: (s: Submission) => void; onAiAssessed: (a: AiAssessment) => void;
}) {
  const evaluationBySession = useMemo(() => new Map(journey.evaluations.map((e) => [e.classSessionId, e])), [journey.evaluations]);
  const submissionBySession = useMemo(() => new Map(journey.submissions.map((s) => [s.classSessionId, s])), [journey.submissions]);

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

    <div className={styles.mobileSessionPicker}>
      <div className={styles.mobileSessionPickerHead}>
        <strong>Chọn buổi để xem và chấm</strong>
        <span>{items.length} buổi</span>
      </div>
      <div className={styles.mobileSessionRail} aria-label="Danh sách buổi học">
      {items.map((it) => {
        const st = statusOf(it.session);
        return (
          <button
            key={it.session.id}
            type="button"
            className={styles.mobileSessionChip}
            data-active={selected?.session.id === it.session.id ? "" : undefined}
            onClick={() => setSelectedId(it.session.id)}
            aria-pressed={selected?.session.id === it.session.id}
          >
            <b data-cat={CATEGORY_FOR_TYPE[it.session.sessionType]}>{it.session.sessionNo}</b>
            <span>{it.date ? fmtShort(it.date) : "Chưa xếp lịch"}</span>
            <i data-state={st}>{st === "graded" ? "✓ Đã chấm" : st === "submitted" ? "• Đã nộp" : "Chưa làm"}</i>
          </button>
        );
      })}
      </div>
    </div>

    <CopilotPanel
      journey={journey}
      session={selected?.session ?? null}
      aiInfo={aiInfo}
      onSubmissionSaved={onSubmissionSaved}
      onAiAssessed={onAiAssessed}
    />
  </div>;
}

// =========================================================================
type CalItem = { session: ClassSession; date: Date | null; synthetic: boolean };

function CurriculumCalendar({ journey, view, selectedId, onSelect }: {
  journey: Journey; view: JourneyView; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const evaluationBySession = useMemo(() => new Map(journey.evaluations.map((e) => [e.classSessionId, e])), [journey.evaluations]);
  const submissionBySession = useMemo(() => new Map(journey.submissions.map((s) => [s.classSessionId, s])), [journey.submissions]);

  const hasRealDates = useMemo(() => journey.sessions.some((s) => s.sessionDate), [journey.sessions]);

  const anchor = useMemo(() => {
    const d = journey.class.startedAt ? new Date(journey.class.startedAt) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : startOfDay(d);
  }, [journey.class.startedAt]);
  const synthDate = useCallback((sessionNo: number) => {
    let d = addDays(anchor, (sessionNo - 1) * 2);
    if (d.getDay() === 0) d = addDays(d, 1); // avoid Sunday
    return d;
  }, [anchor]);

  const types = VIEW_META[view].types;
  const items: CalItem[] = useMemo(() => {
    const list = types === null ? journey.sessions : journey.sessions.filter((s) => types.includes(s.sessionType));
    return list.map((session) => {
      if (session.sessionDate) return { session, date: parseDateOnly(session.sessionDate), synthetic: false };
      if (!hasRealDates) return { session, date: synthDate(session.sessionNo), synthetic: true };
      return { session, date: null, synthetic: false };
    });
  }, [journey.sessions, types, hasRealDates, synthDate]);

  const dated = useMemo(() => items.filter((i) => i.date), [items]);
  const undated = useMemo(() => items.filter((i) => !i.date), [items]);

  const featured = useMemo(() => {
    if (!dated.length) return null;
    const todayTs = startOfDay(new Date()).getTime();
    const upcoming = dated.filter((i) => i.date!.getTime() >= todayTs).sort((a, b) => a.date!.getTime() - b.date!.getTime());
    if (upcoming.length) return upcoming[0];
    return [...dated].sort((a, b) => b.date!.getTime() - a.date!.getTime())[0];
  }, [dated]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of dated) {
      const key = isoKey(it.date!);
      const list = map.get(key);
      if (list) list.push(it);
      else map.set(key, [it]);
    }
    for (const list of map.values()) list.sort((a, b) => a.session.sessionNo - b.session.sessionNo);
    return map;
  }, [dated]);

  const [month, setMonth] = useState<Date>(() => {
    if (featured) return startOfMonth(featured.date!);
    const first = dated.map((i) => i.date!.getTime()).sort((a, b) => a - b)[0];
    return startOfMonth(first ? new Date(first) : new Date());
  });

  const gridStart = useMemo(() => {
    const som = startOfMonth(month);
    return addDays(som, -((som.getDay() + 6) % 7));
  }, [month]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const todayKey = isoKey(new Date());

  const pickDay = (day: Date) => {
    const dayItems = itemsByDay.get(isoKey(day)) ?? [];
    if (dayItems.length) onSelect(dayItems[0].session.id);
  };

  return <div className={styles.calWrap}>
    {featured && (
      <button type="button" className={styles.todayCard} onClick={() => onSelect(featured.session.id)}>
        <div className={styles.todayBox}><b>{featured.session.sessionNo}</b><span>BUỔI</span></div>
        <div className={styles.todayCopy}>
          <span>
            {isoKey(featured.date!) === todayKey ? "Hôm nay" : featured.date!.getTime() >= startOfDay(new Date()).getTime() ? "Buổi tiếp theo" : "Buổi gần nhất"}
            {` · ${fmtShort(featured.date!)}`}
          </span>
          <strong>{SESSION_TYPE_LABEL[featured.session.sessionType]}{featured.session.title ? ` · ${featured.session.title}` : ""}</strong>
          <small>
            {evaluationBySession.get(featured.session.id) ? "Đã chấm điểm"
              : (submissionBySession.get(featured.session.id)?.assetIds.length ?? 0) > 0 ? "Đã nộp minh chứng · chờ chấm"
              : "Chưa nộp minh chứng"}
          </small>
        </div>
        <div className={styles.todayArrow}>›</div>
      </button>
    )}

    {!hasRealDates && dated.length > 0 && (
      <p className={styles.calHint}>Lịch đang hiển thị <b>theo dự kiến</b> (mỗi 2 ngày từ lúc mở lớp). Khi giảng viên xếp lịch chính thức, ngày sẽ tự cập nhật.</p>
    )}

    <div className={styles.calCard}>
      <div className={styles.calHead}>
        <div className={styles.calNav}>
          <button type="button" aria-label="Tháng trước" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft size={16} /></button>
          <strong>{month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</strong>
          <button type="button" aria-label="Tháng sau" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight size={16} /></button>
        </div>
        <button type="button" className={styles.todayBtn} onClick={() => setMonth(startOfMonth(new Date()))}>Hôm nay</button>
      </div>

      <div className={styles.legend}>
        <span data-cat="training">Training</span>
        <span data-cat="makeup">Thực hành Makeup</span>
        <span data-cat="hair">Tóc</span>
        <span data-cat="extra">Ngoại khóa</span>
      </div>

      <div className={styles.calGrid}>
        {DOW.map((d) => <div key={d} className={styles.dow}>{d}</div>)}
        {cells.map((day) => {
          const key = isoKey(day);
          const dayItems = itemsByDay.get(key) ?? [];
          const inMonth = day.getMonth() === month.getMonth();
          const hasSelected = dayItems.some((it) => it.session.id === selectedId);
          return (
            <button
              key={key}
              type="button"
              className={styles.cell}
              data-outside={!inMonth || undefined}
              data-today={key === todayKey || undefined}
              data-has={dayItems.length ? "" : undefined}
              data-selected={hasSelected || undefined}
              onClick={() => pickDay(day)}
            >
              <span className={styles.cellDate}>{day.getDate()}</span>
              <span className={styles.cellChips}>
                {dayItems.slice(0, 3).map((it) => {
                  const ev = evaluationBySession.get(it.session.id);
                  const sub = submissionBySession.get(it.session.id);
                  return <span
                    key={it.session.id}
                    className={styles.chip}
                    data-cat={CATEGORY_FOR_TYPE[it.session.sessionType]}
                    data-graded={ev ? "" : undefined}
                    data-sub={!ev && (sub?.assetIds.length ?? 0) > 0 ? "" : undefined}
                    data-on={it.session.id === selectedId ? "" : undefined}
                  >
                    B{it.session.sessionNo} · {SESSION_TYPE_SHORT[it.session.sessionType]}
                    {ev ? ` · ${ev.totalScore}` : ""}
                  </span>;
                })}
                {dayItems.length > 3 && <span className={styles.chipMore}>+{dayItems.length - 3} buổi</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>

    {hasRealDates && undated.length > 0 && (
      <div className={styles.undated}>
        <div className={styles.undatedHead}>Chưa xếp lịch · {undated.length} buổi</div>
        <div className={styles.undatedRow}>
          {undated.sort((a, b) => a.session.sessionNo - b.session.sessionNo).map((it) => {
            const ev = evaluationBySession.get(it.session.id);
            return <button
              key={it.session.id}
              type="button"
              className={styles.chip}
              data-cat={CATEGORY_FOR_TYPE[it.session.sessionType]}
              data-graded={ev ? "" : undefined}
              data-on={it.session.id === selectedId ? "" : undefined}
              onClick={() => onSelect(it.session.id)}
            >
              B{it.session.sessionNo} · {SESSION_TYPE_SHORT[it.session.sessionType]}{ev ? ` · ${ev.totalScore}` : ""}
            </button>;
          })}
        </div>
      </div>
    )}

    {items.length === 0 && <p className={styles.muted}>Chưa có buổi nào thuộc nhóm này. Giảng viên sẽ bổ sung vào lịch.</p>}
  </div>;
}

// =========================================================================
function SessionDetail({ session, organizationId, rubric, evaluation, submission, aiAssessment, productRubric = MAKEUP_PRODUCT_IMAGE_RUBRIC, aiInfo, autoAssessAt, onConsumeAutoRun, onSaved, onAiAssessed, onRequestCoach, variant, content = "full" }: {
  session: ClassSession;
  organizationId: string;
  rubric: Rubric | null;
  evaluation: Evaluation | null;
  submission: Submission | null;
  aiAssessment: AiAssessment | null;
  productRubric?: readonly ProductRubricCriterion[];
  aiInfo?: AiInfo | null;
  autoAssessAt?: number;
  onConsumeAutoRun?: () => void;
  onSaved: (next: Submission) => void;
  onAiAssessed: (a: AiAssessment) => void;
  onRequestCoach?: () => void;
  variant?: "panel";
  content?: "full" | "evidence" | "self";
}) {
  const [coachOpen, setCoachOpen] = useState(false);
  const hasEvidence = (submission?.assetIds.length ?? 0) > 0;
  const offline = isOfflineEngine(aiInfo ?? null);
  const openCoach = onRequestCoach ?? (() => setCoachOpen(true));
  return <div className={styles.detail}>
    {variant !== "panel" && (
      <div className={styles.detailHead}>
        <strong>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</strong>
        <span className={styles.pill} data-tone={session.status === "completed" ? "done" : session.status === "cancelled" ? "off" : undefined}>
          {SESSION_STATUS_LABEL[session.status]}
        </span>
      </div>
    )}
    {variant !== "panel" && session.title && <p className={styles.detailTitle}>{session.title}</p>}

    <SessionEvidence sessionId={session.id} organizationId={organizationId} rubric={rubric} submission={submission} locked={Boolean(evaluation)} onSaved={onSaved} variant={variant} displayMode={content === "self" ? "self" : content === "evidence" ? "evidence" : "all"} />

    {content === "full" && (evaluation
      ? <GradePanel evaluation={evaluation} rubric={rubric} submission={submission} />
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
        </div>)}

    {content !== "self" && (
      <AiDraftSection
        sessionId={session.id}
        assessment={aiAssessment}
        productRubric={productRubric}
        canRun={hasEvidence}
        offline={offline}
        autoRunAt={autoAssessAt}
        onConsumeAutoRun={onConsumeAutoRun}
        onAiAssessed={onAiAssessed}
        onOpenCoach={openCoach}
      />
    )}

    {!onRequestCoach && coachOpen && <AICoachSheet sessionId={session.id} sessionTitle={`Buổi ${session.sessionNo}${session.title ? ` · ${session.title}` : ""}`} onClose={() => setCoachOpen(false)} />}
  </div>;
}

function AiDraftSection({ sessionId, assessment, productRubric, canRun, offline, autoRunAt, onConsumeAutoRun, onAiAssessed, onOpenCoach }: {
  sessionId: string;
  assessment: AiAssessment | null;
  productRubric: readonly ProductRubricCriterion[];
  canRun: boolean;
  offline: boolean;
  autoRunAt?: number;
  onConsumeAutoRun?: () => void;
  onAiAssessed: (a: AiAssessment) => void;
  onOpenCoach: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const analyzeLabel = offline ? "Phân tích bộ ảnh Makeup" : "Phân tích chuyên sâu bộ ảnh";

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
        setMessage("Không chạy được phân tích ảnh. Bộ ảnh của bạn vẫn được giữ.");
        return;
      }
      onAiAssessed(payload.assessment);
    } finally {
      setRunning(false);
    }
  }

  // Kicked from the chat flow: photos were just saved, run the rubric pre-check exactly once.
  // onConsumeAutoRun() clears the parent trigger so re-opening this tab never re-fires it.
  useEffect(() => {
    if (!autoRunAt || !canRun || running) return;
    onConsumeAutoRun?.();
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunAt]);

  const a = assessment && isMakeupProductImageRubric(assessment.rubricSnapshot) ? assessment : null;
  const needsRefresh = Boolean(assessment && !a);
  const productMaxScore = productRubric.reduce((sum, criterion) => sum + criterion.maxScore, 0);
  return <div className={styles.aiCard}>
    <div className={styles.aiHead}>
      <strong>Phân tích sản phẩm Makeup theo hình ảnh</strong>
      <span className={styles.aiDraftTag}>{productRubric.length} TIÊU CHÍ · {productMaxScore} ĐIỂM</span>
    </div>

    {a && a.status === "ai_draft" && (
      <>
        <div className={styles.aiScore}>
          <div><small>Điểm sơ bộ</small><strong>{a.totalScore ?? "—"}<i>/{a.maxScore}</i></strong></div>
          <span className={styles.pill} data-tone="info">{offline ? "Cấu hình offline" : a.provider}</span>
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
        <small className={styles.aiTime}>Chấm sơ bộ lúc {new Date(a.createdAt).toLocaleString("vi-VN")}</small>
      </>
    )}

    {a && a.status === "unavailable" && (
      <p className={styles.aiSummary}>Bộ đánh giá tạm thời không khả dụng ({a.provider}). Bài nộp của bạn vẫn được lưu — thử lại sau.</p>
    )}

    {message && <p className={styles.aiSummary} style={{ color: "#b22949" }}>{message}</p>}

    {needsRefresh && <p className={styles.aiSummary}>Kết quả cũ dùng bộ tiêu chí của lớp học. Hãy phân tích lại để chuyển sang bộ tiêu chí sản phẩm Makeup mới.</p>}

    {!canRun && !a && <p className={styles.aiSummary}>Tải ít nhất một ảnh Makeup để bắt đầu phân tích theo bộ tiêu chí sản phẩm.</p>}

    <div className={styles.aiActions}>
      <button type="button" className={styles.primaryBtn} disabled={running || !canRun} onClick={run}>
        {running ? "Đang phân tích ảnh…" : a ? "Phân tích lại bộ ảnh" : analyzeLabel}
      </button>
      {a && a.status === "ai_draft" && (
        <button type="button" className={styles.aiCoachBtn} onClick={onOpenCoach}>Hỏi H2O Copilot</button>
      )}
    </div>
    <p className={styles.aiPrivacy}>Đối chiếu bộ ảnh với tiêu chí sản phẩm Makeup đã cài đặt. Bản offline là nhận xét sơ bộ; giáo viên xác nhận kết quả cuối buổi.</p>
  </div>;
}

// Controlled chat surface — the transcript lives in useCoachThread (mobile sheet) or in
// CopilotPanel (desktop tab, which also feeds it photo + assessment messages).
function CoachConversation({ messages, loading, onSend, onAttach }: {
  messages: ChatMsg[];
  loading: boolean;
  onSend: (text: string) => void;
  onAttach?: (files: File[]) => void;
}) {
  const [text, setText] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [messages, loading]);

  const submit = () => { const c = text.trim(); if (!c) return; onSend(c); setText(""); };

  return <>
    <div className={styles.coachBody} ref={bodyRef}>
      {messages.map((m) => (
        <div key={m.id} className={styles.bubble} data-role={m.role}>
          {m.images && m.images.length > 0 && (
            <span className={styles.bubbleThumbs}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.images.map((src) => <img key={src} src={src} alt="Ảnh minh chứng" />)}
            </span>
          )}
          {m.content}
        </div>
      ))}
      {loading && <div className={styles.bubble} data-role="assistant">Đang xử lý…</div>}
    </div>
    <div className={styles.coachQuick}>
      {onAttach && (
        <label className={styles.coachAttach}>
          <ImagePlus size={14} /> Gửi ảnh
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.currentTarget.value = ""; if (fs.length) onAttach(fs); }} />
        </label>
      )}
      {COACH_QUICK.map((q) => <button key={q} type="button" onClick={() => onSend(q)}>{q}</button>)}
    </div>
    <div className={styles.coachInput}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Hỏi H2O Mentor…" onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button type="button" onClick={submit} aria-label="Gửi">➤</button>
    </div>
  </>;
}

function AICoachSheet({ sessionId, sessionTitle, onClose }: { sessionId: string; sessionTitle: string; onClose: () => void }) {
  const thread = useCoachThread(sessionId, sessionTitle);
  return <>
    <div className={styles.coachBackdrop} onClick={onClose} />
    <section className={styles.coachSheet} role="dialog" aria-label="H2O Learning Copilot">
      <div className={styles.coachHead}>
        <div><small>✦ H2O Learning Copilot</small><strong>{sessionTitle}</strong></div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={16} /></button>
      </div>
      <CoachConversation messages={thread.messages} loading={thread.loading} onSend={thread.send} />
    </section>
  </>;
}

function SessionEvidence({ sessionId, organizationId, rubric, submission, locked, onSaved, variant, displayMode = "all" }: {
  sessionId: string;
  organizationId: string;
  rubric: Rubric | null;
  submission: Submission | null;
  locked: boolean;
  onSaved: (next: Submission) => void;
  variant?: "panel";
  displayMode?: "all" | "evidence" | "self";
}) {
  const [assetIds, setAssetIds] = useState<string[]>(submission?.assetIds ?? []);
  const [note, setNote] = useState(submission?.note ?? "");
  const [scores, setScores] = useState<Record<string, number>>(submission?.criterionScores ?? {});
  const [durationMinutes, setDurationMinutes] = useState(submission?.durationMinutes == null ? "" : String(submission.durationMinutes));
  const [repairPlan, setRepairPlan] = useState<RepairPlanItem[]>(submission?.repairPlan ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const latestDraftRef = useRef<LocalAssessmentDraft | null>(null);
  const showEvidence = displayMode !== "self";
  const showSelfAssessment = displayMode !== "evidence";
  const draftKey = `h2obook:student-assessment-draft:${sessionId}:${displayMode}`;

  useEffect(() => {
    let nextAssetIds = submission?.assetIds ?? [];
    let nextNote = submission?.note ?? "";
    let nextScores = submission?.criterionScores ?? {};
    let nextDuration = submission?.durationMinutes == null ? "" : String(submission.durationMinutes);
    let nextRepairPlan = submission?.repairPlan ?? [];
    let restored = false;
    if (!locked) {
      try {
        const raw = window.localStorage.getItem(draftKey);
        const draft = raw ? JSON.parse(raw) as LocalAssessmentDraft : null;
        if (draft) {
          if (showEvidence && Array.isArray(draft.assetIds)) nextAssetIds = draft.assetIds;
          if (showSelfAssessment) {
            if (typeof draft.note === "string") nextNote = draft.note;
            if (draft.criterionScores && typeof draft.criterionScores === "object") nextScores = draft.criterionScores;
            if (typeof draft.durationMinutes === "string") nextDuration = draft.durationMinutes;
            if (Array.isArray(draft.repairPlan)) nextRepairPlan = draft.repairPlan;
          }
          restored = true;
        }
      } catch {
        window.localStorage.removeItem(draftKey);
      }
    }
    setAssetIds(nextAssetIds);
    setNote(nextNote);
    setScores(nextScores);
    setDurationMinutes(nextDuration);
    setRepairPlan(nextRepairPlan);
    if (restored) setMessage("Đã khôi phục bản nháp trên điện thoại.");
  }, [draftKey, locked, showEvidence, showSelfAssessment, submission]);

  const duration = durationMinutes.trim() === "" ? null : Number(durationMinutes);
  const timeBand = makeupTimeBand(duration);
  const speedCriterion = rubric?.criteria.find((criterion) => criterion.skillKey === "speed");
  const speedCriterionId = speedCriterion?.id;
  const speedCriterionMax = speedCriterion?.maxScore;
  const scoreCap = (criterion: RubricCriterion) => criterion.id === speedCriterionId && timeBand != null
    ? Math.min(criterion.maxScore, timeBand + 5)
    : criterion.maxScore;
  const criterionScore = (criterion: RubricCriterion) => Math.min(scoreCap(criterion), Math.max(0, Number(scores[criterion.id] ?? 0)));

  useEffect(() => {
    if (!speedCriterionId || speedCriterionMax == null || timeBand == null) return;
    const cap = Math.min(speedCriterionMax, timeBand + 5);
    setScores((current) => {
      const currentScore = Number(current[speedCriterionId] ?? 0);
      return currentScore > cap ? { ...current, [speedCriterionId]: cap } : current;
    });
  }, [speedCriterionId, speedCriterionMax, timeBand]);

  const dirty = note !== (submission?.note ?? "") ||
    assetIds.length !== (submission?.assetIds.length ?? 0) ||
    assetIds.some((id, i) => id !== submission?.assetIds[i]) ||
    durationMinutes !== (submission?.durationMinutes == null ? "" : String(submission.durationMinutes)) ||
    repairPlanSignature(repairPlan) !== repairPlanSignature(submission?.repairPlan ?? []) ||
    Boolean(rubric && rubric.criteria.some((criterion) => criterionScore(criterion) !== Number(submission?.criterionScores?.[criterion.id] ?? 0)));
  const selfTotal = rubric?.criteria.reduce((sum, criterion) => sum + criterionScore(criterion), 0) ?? 0;
  const selfMax = rubric?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) ?? 0;
  const completedRepairCount = repairPlan.filter((item) => item.completed).length;

  // Keep a light local draft so changing tabs, choosing another session, closing the keyboard or
  // briefly losing the network cannot discard scores and notes. Only the fields owned by this tab
  // are cached, so saving evidence never overwrites an unfinished self-assessment (and vice versa).
  useEffect(() => {
    if (locked || !dirty) {
      latestDraftRef.current = null;
      return;
    }
    const draft: LocalAssessmentDraft = {
      savedAt: Date.now(),
      ...(showEvidence ? { assetIds } : {}),
      ...(showSelfAssessment ? { note, criterionScores: scores, durationMinutes, repairPlan } : {}),
    };
    latestDraftRef.current = draft;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [assetIds, dirty, draftKey, durationMinutes, locked, note, repairPlan, scores, showEvidence, showSelfAssessment]);

  useEffect(() => () => {
    const draft = latestDraftRef.current;
    if (draft) window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftKey]);

  const updateRepairPlan = (index: number, patch: Partial<RepairPlanItem>) => {
    setRepairPlan((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addRepairItem = () => {
    if (!rubric || repairPlan.length >= 3) return;
    const used = new Set(repairPlan.map((item) => item.criterionId));
    const first = rubric.criteria.find((criterion) => !used.has(criterion.id));
    if (!first) return;
    setRepairPlan((current) => [...current, {
      criterionId: first.id,
      action: "practice_again",
      issue: "",
      nextStep: "",
      completed: false,
    }]);
  };

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
        body: JSON.stringify({
          classSessionId: sessionId,
          assetIds,
          note,
          rubricId: rubric?.id,
          criterionScores: scores,
          durationMinutes: duration,
          repairPlan,
        })
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
      window.localStorage.removeItem(draftKey);
      latestDraftRef.current = null;
      onSaved(payload.submission);
      setMessage("Đã lưu tự chấm và kế hoạch tự chữa.");
    } finally {
      setSaving(false);
    }
  }

  const bigDrop = showEvidence && variant === "panel" && assetIds.length === 0 && !locked;

  return <div className={styles.evidence}>
    {showEvidence && <div className={styles.evidenceHead}>
      <span>Ảnh sản phẩm Makeup {locked && <em>· đã khoá vì buổi đã được chấm</em>}</span>
    </div>}
    {showEvidence && <div className={styles.photoGuide}>
      <div><strong>Bộ ảnh khuyến nghị</strong><span>{assetIds.length}/{MAX_EVIDENCE} ảnh</span></div>
      <p>Chụp đủ ánh sáng, không dùng filter làm thay đổi màu da và giữ cùng một tone sáng giữa các ảnh.</p>
      <div className={styles.photoGuideChips}>
        {MAKEUP_PHOTO_GUIDE.map((item, index) => <span key={item}>{index + 1}. {item}</span>)}
      </div>
    </div>}
    {showSelfAssessment && rubric && rubric.criteria.length > 0 && (
      <section className={styles.selfAssessment} aria-label="Tự đánh giá theo rubric">
        <div className={styles.selfAssessmentHead}>
          <div><strong>Tự chấm trước khi giáo viên duyệt</strong><small>Điểm này là bản tự đánh giá; giáo viên sẽ đối chiếu và quyết định điểm chính thức.</small></div>
          <b>{selfTotal}<i>/{selfMax}</i></b>
        </div>
        <div className={styles.selfCriteria}>
          {speedCriterion && (
            <label className={styles.selfTiming}>
              <span>Thời gian hoàn thành <small>(chỉ cho phần thực hành Makeup)</small></span>
              <div>
                <input
                  type="number"
                  min={1}
                  max={600}
                  inputMode="numeric"
                  disabled={locked}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  placeholder="phút"
                  aria-label="Thời gian hoàn thành, tính bằng phút"
                />
                <b>phút</b>
              </div>
              <small>{timeBand == null
                ? "Nhập thời gian để kiểm tra phần thời lượng (tối đa 5 điểm); 5 điểm còn lại là kiểm soát tiến độ."
                : `Thời lượng hiện tại: ${timeBand}/5 điểm. Bạn có thể tự chấm thêm tối đa 5 điểm cho kiểm soát tiến độ.`}</small>
            </label>
          )}
          {rubric.criteria.map((criterion) => {
            const score = criterionScore(criterion);
            const cap = scoreCap(criterion);
            const setScore = (next: number) => setScores((current) => ({ ...current, [criterion.id]: Math.min(cap, Math.max(0, next)) }));
            return <div key={criterion.id} className={styles.selfCriterion}>
              <span>{criterion.title}{criterion.required ? <em> bắt buộc</em> : null}</span>
              <output>{score}/{criterion.maxScore}</output>
              <div className={styles.scoreControl}>
                <button type="button" disabled={locked || score <= 0} onClick={() => setScore(score - 1)} aria-label={`Giảm điểm ${criterion.title}`}>−</button>
                <input
                  type="range"
                  min={0}
                  max={cap}
                  step={1}
                  disabled={locked}
                  value={score}
                  onChange={(event) => setScore(Number(event.target.value))}
                  aria-label={`Điểm tự đánh giá: ${criterion.title}`}
                />
                <button type="button" disabled={locked || score >= cap} onClick={() => setScore(score + 1)} aria-label={`Tăng điểm ${criterion.title}`}>+</button>
              </div>
            </div>;
          })}
        </div>
      </section>
    )}
    {showSelfAssessment && rubric && rubric.criteria.length > 0 && (
      <section className={styles.repairPlanner} aria-label="Kế hoạch tự chữa bài">
        <div className={styles.repairHead}>
          <div>
            <strong>Tự chữa bài theo tiêu chí</strong>
            <small>Chọn tối đa 3 điểm cần cải thiện trong buổi này. Giáo viên sẽ xem kế hoạch cùng ảnh và phần tự chấm của bạn.</small>
          </div>
          <b>{completedRepairCount}<i>/{repairPlan.length || 0}</i></b>
        </div>

        {!repairPlan.length && (
          <p className={styles.repairEmpty}>Chưa chọn mục tự chữa. Chọn một tiêu chí bạn chưa tự tin, viết lỗi nhận ra và bước sẽ làm ngay.</p>
        )}

        <div className={styles.repairItems}>
          {repairPlan.map((item, index) => {
            const selectedCriterion = rubric.criteria.find((criterion) => criterion.id === item.criterionId);
            const usedCriterionIds = new Set(repairPlan.filter((_, itemIndex) => itemIndex !== index).map((entry) => entry.criterionId));
            return <article key={`${item.criterionId}-${index}`} className={styles.repairItem} data-completed={item.completed || undefined}>
              <div className={styles.repairItemTop}>
                <label>
                  <span>Tiêu chí cần chữa</span>
                  <select disabled={locked} value={item.criterionId} onChange={(event) => updateRepairPlan(index, { criterionId: event.target.value, completed: false })}>
                    {rubric.criteria.map((criterion) => <option key={criterion.id} value={criterion.id} disabled={usedCriterionIds.has(criterion.id)}>
                      {criterion.title} · {criterionScore(criterion)}/{criterion.maxScore}
                    </option>)}
                  </select>
                </label>
                {!locked && <button type="button" className={styles.repairRemove} onClick={() => setRepairPlan((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Bỏ mục tự chữa">×</button>}
              </div>
              {selectedCriterion?.description && <details className={styles.repairGuide}>
                <summary>Chuẩn cần đạt</summary>
                <small>{selectedCriterion.description}</small>
              </details>}
              <label className={styles.repairField}>
                <span>Lỗi em nhận ra</span>
                <textarea disabled={locked} rows={2} maxLength={320} value={item.issue} onChange={(event) => updateRepairPlan(index, { issue: event.target.value })} placeholder="Ví dụ: Nền bị mốc ở vùng mũi, chuyển màu má chưa đều…" />
              </label>
              <div className={styles.repairActionRow}>
                <label className={styles.repairField}>
                  <span>Cách em xử lý</span>
                  <select disabled={locked} value={item.action} onChange={(event) => updateRepairPlan(index, { action: event.target.value as RepairAction })}>
                    {Object.entries(REPAIR_ACTION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className={styles.repairField}>
                  <span>Bước làm ngay</span>
                  <input disabled={locked} maxLength={320} value={item.nextStep} onChange={(event) => updateRepairPlan(index, { nextStep: event.target.value })} placeholder="Ví dụ: Luyện lại 1 nửa mặt, chụp ảnh gửi cô" />
                </label>
              </div>
              <label className={styles.repairDone}>
                <input type="checkbox" disabled={locked} checked={item.completed} onChange={(event) => updateRepairPlan(index, { completed: event.target.checked })} />
                <span>Em đã luyện/xử lý mục này và muốn giáo viên kiểm tra</span>
              </label>
            </article>;
          })}
        </div>
        {!locked && <button type="button" className={styles.repairAdd} disabled={repairPlan.length >= 3 || repairPlan.length >= rubric.criteria.length} onClick={addRepairItem}>
          + Thêm mục cần tự chữa {repairPlan.length ? `(${repairPlan.length}/3)` : ""}
        </button>}
      </section>
    )}
    {showEvidence && <div className={styles.thumbRow}>
      {assetIds.map((id) => (
        <span key={id} className={styles.thumb}>
          <AssetThumb assetId={id} />
          {!locked && <button type="button" aria-label="Bỏ ảnh này" onClick={() => setAssetIds((v) => v.filter((x) => x !== id))}><X size={12} /></button>}
        </span>
      ))}
      {!locked && assetIds.length < MAX_EVIDENCE && (
        <label className={bigDrop ? styles.dropzone : styles.addThumb}>
          <ImagePlus size={bigDrop ? 22 : 16} />
          <span>{uploading ? "Đang tải…" : bigDrop ? "Tải ảnh minh chứng" : "Thêm ảnh"}</span>
          {bigDrop && <small>Ảnh được nén và xử lý ngay trên thiết bị trước khi lưu.</small>}
          <input type="file" accept="image/*" multiple disabled={uploading} onChange={onPick} hidden />
        </label>
      )}
      {assetIds.length === 0 && locked && <span className={styles.muted}>Không có ảnh nào được nộp cho buổi này.</span>}
    </div>}
    {showSelfAssessment && !locked && <textarea
      className={styles.note}
      value={note}
      onChange={(e) => setNote(e.target.value)}
      rows={2}
      maxLength={500}
      placeholder="Tự ghi chú: phần làm tốt, lỗi cần sửa, điều muốn hỏi giáo viên…"
    />}
    {showSelfAssessment && locked && note && <p className={styles.lockedNote}>{note}</p>}
    {!locked && <div className={styles.evidenceActions} data-dirty={dirty || undefined}>
      <button type="button" className={styles.primaryBtn} disabled={saving || uploading || !dirty} onClick={save}>
        {saving ? "Đang lưu…" : displayMode === "self" ? "Lưu tự đánh giá & ghi chú" : displayMode === "evidence" ? "Lưu minh chứng" : "Lưu tự chấm & ghi chú"}
      </button>
      <span className={styles.message} role="status">{saving ? "Đang đồng bộ…" : dirty ? "Có thay đổi chưa lưu" : message ?? "Đã đồng bộ"}</span>
    </div>}
    {locked && message && <span className={styles.message}>{message}</span>}
  </div>;
}

function GradePanel({ evaluation, rubric, submission }: { evaluation: Evaluation; rubric: Rubric | null; submission: Submission | null }) {
  const percent = pct(evaluation.totalScore, evaluation.maxScore);
  return <div className={styles.gradePanel}>
    <div className={styles.gradeTop}>
      <div>
        <span>Điểm giảng viên</span>
        <strong>{evaluation.totalScore}<i>/{evaluation.maxScore}</i></strong>
      </div>
      <span className={styles.pill} data-tone={percent >= 90 ? "done" : percent >= 70 ? "info" : "warn"}>{percent}%</span>
    </div>
    {submission?.totalScore != null && <div className={styles.selfVsTeacher}>
      <span>Bạn tự chấm <b>{submission.totalScore}/{submission.maxScore ?? evaluation.maxScore}</b></span>
      <span>Chênh lệch <b data-positive={evaluation.totalScore >= submission.totalScore ? "" : undefined}>{evaluation.totalScore >= submission.totalScore ? "+" : ""}{(evaluation.totalScore - submission.totalScore).toFixed(0)} điểm</b></span>
    </div>}

    {rubric && rubric.criteria.length > 0 && (
      <ul className={styles.criteriaList}>
        {rubric.criteria.map((c) => {
          const s = evaluation.criterionScores[c.id] ?? 0;
          return <li key={c.id}>
            <span>{c.title}</span>
            <b data-low={s < c.maxScore * 0.6 ? "" : undefined}>{submission?.criterionScores[c.id] != null ? `Tự ${submission.criterionScores[c.id]} · ` : ""}{s} / {c.maxScore}</b>
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
